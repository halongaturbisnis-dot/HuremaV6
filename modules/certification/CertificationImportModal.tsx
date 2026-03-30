
import React, { useState } from 'react';
import { X, FileUp, Download, CheckCircle, AlertTriangle, Save, Loader2, Paperclip, Trash2, FileText, UploadCloud } from 'lucide-react';
import Swal from 'sweetalert2';
import { certificationService } from '../../services/certificationService';
import { googleDriveService } from '../../services/googleDriveService';

interface CertificationImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CertificationImportModal: React.FC<CertificationImportModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const results = await certificationService.processImport(file) as any[];
      setPreviewData(results);
      setStep(2);
    } catch (error) {
      Swal.fire('Gagal', 'Format file tidak didukung.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getMatchedFile = (certName: string, fullName: string) => {
    return attachedFiles.find(f => {
      const fileName = f.name.toLowerCase();
      const certNameLower = certName.toLowerCase();
      const fullNameLower = fullName.toLowerCase();
      // Match if filename contains cert name OR cert name contains filename (without extension)
      // Also check if filename contains full name for better accuracy
      const baseFileName = fileName.split('.')[0];
      return (fileName.includes(certNameLower) || certNameLower.includes(baseFileName)) && 
             (fileName.includes(fullNameLower) || fullNameLower.includes(baseFileName));
    });
  };

  const handleCommit = async () => {
    const validData = previewData.filter(d => d.isValid);
    if (validData.length === 0) return Swal.fire('Peringatan', 'Tidak ada data valid.', 'warning');

    const confirm = await Swal.fire({
      title: 'Konfirmasi Impor',
      text: `Impor ${validData.length} sertifikasi?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#006E62',
      confirmButtonText: 'Ya, Impor'
    });

    if (confirm.isConfirmed) {
      try {
        setIsUploading(true);
        
        // Process each item
        const finalResults = [];
        for (const item of validData) {
          let fileId = item.file_link ? item.file_link.match(/[-\w]{25,}/)?.[0] : null;
          
          // Try to match with attached files if no link provided
          if (!fileId) {
            const matchedFile = getMatchedFile(item.cert_name, item.full_name);
            if (matchedFile) {
              fileId = await googleDriveService.uploadFile(matchedFile);
            }
          }

          const res = await certificationService.create({
            account_id: item.account_id,
            entry_date: new Date().toISOString().split('T')[0],
            cert_type: item.cert_type,
            cert_name: item.cert_name,
            cert_date: item.cert_date,
            notes: item.notes,
            file_id: fileId || null
          });
          finalResults.push(res);
        }

        Swal.fire('Berhasil!', 'Data sertifikasi telah diimpor.', 'success');
        onSuccess();
      } catch (error) {
        Swal.fire('Gagal', 'Terjadi kesalahan saat mengunggah data.', 'error');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#006E62]">Impor Massal Sertifikasi</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              {step === 1 ? 'Tahap 1: Unggah Excel' : step === 2 ? 'Tahap 1: Pratinjau Data' : 'Tahap 2: Unggah Lampiran'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-6 flex flex-col items-center py-10">
              <div className="w-16 h-16 bg-emerald-50 text-[#006E62] rounded-full flex items-center justify-center mb-4">
                <FileUp size={32} />
              </div>
              <div className="text-center max-w-md">
                <h4 className="text-lg font-bold text-gray-800">Unggah Excel Sertifikasi</h4>
                <p className="text-xs text-gray-500 mt-2">Gunakan template resmi untuk mengunggah data sertifikat karyawan secara massal.</p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button onClick={() => certificationService.downloadTemplate()} className="flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 rounded-md hover:bg-gray-50 transition-colors text-sm font-bold text-gray-600 uppercase">
                  <Download size={18} /> 1. Download Template
                </button>
                <label className="flex items-center justify-center gap-2 bg-[#006E62] text-white px-4 py-3 rounded-md hover:bg-[#005a50] transition-colors shadow-md text-sm font-bold uppercase cursor-pointer">
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                  {isProcessing ? 'Memproses...' : '2. Unggah Excel'}
                  <input type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} disabled={isProcessing} />
                </label>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-md border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                  <CheckCircle size={20} /> Terbaca {previewData.length} baris. ({previewData.filter(d => d.isValid).length} Valid)
                </div>
                <button onClick={() => setStep(1)} className="text-[10px] font-bold uppercase text-[#006E62]">Ganti File</button>
              </div>
              <div className="border border-gray-100 rounded overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 font-bold text-gray-500 uppercase">
                    <tr><th className="px-4 py-2">Status</th><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Jenis</th><th className="px-4 py-2">Sertifikat</th><th className="px-4 py-2">Tgl</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                        <td className="px-4 py-2">{row.isValid ? <CheckCircle size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-red-500" />}</td>
                        <td className="px-4 py-2 font-bold">{row.full_name}</td>
                        <td className="px-4 py-2">{row.cert_type}</td>
                        <td className="px-4 py-2">{row.cert_name}</td>
                        <td className="px-4 py-2">{row.cert_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Instruksi Tahap 2</h4>
                    <p className="text-[11px] text-blue-600 leading-relaxed">
                      Unggah file sertifikat (PDF/Gambar). Sistem akan mencoba mencocokkan file secara otomatis berdasarkan <strong>Nama Sertifikasi</strong> dan <strong>Nama Karyawan</strong>.
                    </p>
                  </div>

                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Klik untuk Unggah Lampiran</p>
                      <p className="text-[10px] text-gray-400 mt-1">PDF, JPG, PNG (Bisa pilih banyak sekaligus)</p>
                    </div>
                    <input type="file" className="hidden" multiple accept="image/*,application/pdf" onChange={handleFilesChange} />
                  </label>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">File Terunggah ({attachedFiles.length})</h4>
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                      {attachedFiles.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic">Belum ada file yang dipilih.</p>
                      ) : (
                        attachedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded text-[10px]">
                            <div className="flex items-center gap-2 truncate">
                              <FileText size={14} className="text-gray-400" />
                              <span className="truncate font-medium text-gray-600">{file.name}</span>
                            </div>
                            <button onClick={() => removeFile(idx)} className="text-red-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status Pencocokan</h4>
                  <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {previewData.filter(d => d.isValid).map((row, idx) => {
                      const matchedFile = getMatchedFile(row.cert_name, row.full_name);
                      return (
                        <div key={idx} className={`p-3 rounded-md border transition-all ${matchedFile ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-800 truncate">{row.full_name}</span>
                            {matchedFile ? (
                              <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle size={10} /> TERCOCOKKAN
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-orange-400 flex items-center gap-1">
                                <AlertTriangle size={10} /> TANPA FILE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">{row.cert_name}</div>
                          {matchedFile && (
                            <div className="mt-2 flex items-center gap-1.5 text-[9px] text-emerald-700 font-mono italic truncate">
                              <Paperclip size={10} /> {matchedFile.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Batal</button>
          {step === 2 && (
            <button onClick={() => setStep(3)} className="flex items-center gap-2 bg-[#006E62] text-white px-8 py-2 rounded shadow-md hover:bg-[#005a50] transition-all text-xs font-bold uppercase">
              Lanjut Tahap 2
            </button>
          )}
          {step === 3 && (
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-xs font-bold text-[#006E62] uppercase">Kembali</button>
              <button onClick={handleCommit} disabled={isUploading} className="flex items-center gap-2 bg-[#006E62] text-white px-8 py-2 rounded shadow-md hover:bg-[#005a50] transition-all text-xs font-bold uppercase disabled:opacity-50">
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {isUploading ? 'Memproses...' : 'Simpan Data'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificationImportModal;
