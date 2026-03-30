
import { supabase } from '../lib/supabase';
import { AccountCertification, AccountCertificationExtended, AccountCertificationInput } from '../types';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { accountService } from './accountService';

const sanitizePayload = (payload: any) => {
  const sanitized = { ...payload };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === '' || sanitized[key] === undefined) {
      sanitized[key] = null;
    }
  });
  return sanitized;
};

export const certificationService = {
  async getAllGlobal() {
    const { data, error } = await supabase
      .from('account_certifications')
      .select(`
        *,
        account:accounts(full_name, internal_nik, role, access_code, photo_google_id)
      `)
      .order('entry_date', { ascending: false });
    
    if (error) throw error;
    // Filter out logs where account access_code contains SPADMIN (case-insensitive)
    return (data as any[]).filter(log => !log.account?.access_code?.toUpperCase().includes('SPADMIN')) as AccountCertificationExtended[];
  },

  async getByAccountId(accountId: string) {
    const { data, error } = await supabase
      .from('account_certifications')
      .select('*')
      .eq('account_id', accountId)
      .order('cert_date', { ascending: false });
    
    if (error) throw error;
    return data as AccountCertification[];
  },

  async getUniqueCertTypes() {
    const { data, error } = await supabase
      .from('account_certifications')
      .select('cert_type');
    
    if (error) throw error;
    const types = data.map(d => d.cert_type).filter(Boolean);
    return Array.from(new Set(types)).sort();
  },

  async create(input: AccountCertificationInput) {
    const sanitized = sanitizePayload(input);
    const { data, error } = await supabase
      .from('account_certifications')
      .insert([sanitized])
      .select();
    
    if (error) throw error;
    return data[0] as AccountCertification;
  },

  async update(id: string, input: Partial<AccountCertificationInput>) {
    const sanitized = sanitizePayload(input);
    const { data, error } = await supabase
      .from('account_certifications')
      .update(sanitized)
      .eq('id', id)
      .select();
    
    if (error) throw error;
    return data[0] as AccountCertification;
  },

  async delete(id: string) {
    // 1. Ambil ID file
    const { data } = await supabase.from('account_certifications').select('file_id').eq('id', id).single();
    
    // 2. Hapus file dari Drive
    if (data?.file_id) {
      const { googleDriveService } = await import('./googleDriveService');
      await googleDriveService.deleteFile(data.file_id);
    }

    // 3. Hapus dari DB
    const { error } = await supabase
      .from('account_certifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async bulkDelete(ids: string[]) {
    for (const id of ids) {
      await this.delete(id);
    }
    return true;
  },

  async downloadTemplate() {
    const accounts = await accountService.getAll();
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Certification_Import');
    
    // Baris 1: Instruksi
    const instructions = [
      'INSTRUKSI PENGISIAN:',
      '1. Kolom berlabel (*) wajib diisi.',
      '2. Format Tanggal harus YYYY-MM-DD (Contoh: 2024-01-01).',
      '3. Jangan mengubah kolom Account ID (Hidden) dan NIK Internal.',
      '4. Data dimulai dari baris ke-4.'
    ];
    ws.addRow([instructions.join(' ')]);
    ws.mergeCells(1, 1, 1, 8);
    ws.getRow(1).height = 30;
    ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };

    // Baris 2: Contoh
    const example = [
      'CONTOH_ID',
      'NIK_CONTOH',
      'NAMA_CONTOH',
      'Teknis',
      'Sertifikasi K3 Umum',
      '2024-03-30',
      'Contoh pengisian data',
      ''
    ];
    ws.addRow(example);
    ws.getRow(2).font = { italic: true, color: { argb: 'FF999999' } };

    // Baris 3: Header
    const headers = [
      'Account ID (Hidden)', 
      'NIK Internal', 
      'Nama Karyawan', 
      'Jenis Sertifikasi (*)', 
      'Nama Sertifikasi (*)', 
      'Tanggal Sertifikasi (YYYY-MM-DD) (*)', 
      'Keterangan',
      'Link File G-Drive (Opsional)'
    ];
    ws.addRow(headers);
    ws.getRow(3).font = { bold: true };
    ws.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data mulai baris 4
    accounts.forEach(acc => {
      ws.addRow([acc.id, acc.internal_nik, acc.full_name, '', '', '', '', '']);
    });

    const maxRow = ws.rowCount + 500;
    for (let i = 4; i <= maxRow; i++) {
      const dateCell = ws.getCell(`F${i}`);
      dateCell.dataValidation = {
        type: 'date',
        operator: 'greaterThan',
        allowBlank: true,
        formulae: [new Date(1900, 0, 1)]
      };
      dateCell.numFmt = 'yyyy-mm-dd';
    }

    ws.columns.forEach((col, idx) => {
      col.width = [20, 15, 25, 20, 25, 25, 25, 25][idx];
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `HUREMA_Certification_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  async processImport(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 2 });

          const results = jsonData.map((row: any) => {
            const parseDate = (val: any) => {
              if (typeof val === 'number') {
                const date = new Date((val - 25569) * 86400 * 1000);
                return date.toISOString().split('T')[0];
              }
              return val;
            };

            const certDate = parseDate(row['Tanggal Sertifikasi (YYYY-MM-DD) (*)']);

            return {
              account_id: row['Account ID (Hidden)'],
              full_name: row['Nama Karyawan'],
              internal_nik: row['NIK Internal'],
              cert_type: row['Jenis Sertifikasi (*)'],
              cert_name: row['Nama Sertifikasi (*)'],
              cert_date: certDate,
              notes: row['Keterangan'] || null,
              file_link: row['Link File G-Drive (Opsional)'] || null,
              isValid: !!(row['Account ID (Hidden)'] && row['Jenis Sertifikasi (*)'] && row['Nama Sertifikasi (*)'] && certDate)
            };
          });
          resolve(results);
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  },

  async commitImport(data: any[]) {
    const validData = data.filter(d => d.isValid);
    const results = [];
    for (const item of validData) {
      const driveId = item.file_link ? item.file_link.match(/[-\w]{25,}/)?.[0] : null;
      const res = await this.create({
        account_id: item.account_id,
        entry_date: new Date().toISOString().split('T')[0],
        cert_type: item.cert_type,
        cert_name: item.cert_name,
        cert_date: item.cert_date,
        notes: item.notes,
        file_id: driveId || null
      });
      results.push(res);
    }
    return results;
  }
};
