import React, { useState } from 'react';
import { X, FileUp, Download, CheckCircle, AlertTriangle, Save, Loader2, Paperclip, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { disciplineService } from '../../services/disciplineService';
import { googleDriveService } from '../../services/googleDriveService';

interface DisciplineImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
  type?: 'warning' | 'termination';
}

const DisciplineImportModal: React.FC<DisciplineImportModalProps> = ({ onClose, onSuccess, type = 'warning' }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const results = type === 'warning' 
        ? await disciplineService.processWarningImport(file) as any[]
        : await disciplineService.processTerminationImport(file) as any[];
      setPreviewData(results);
      setStep(2);
    } catch (error) {
      Swal.fire('Gagal', 'Format file tidak didukung atau kolom tidak sesuai.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDocFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const getMatchedFile = (name: string) => {
    return selectedFiles.find(f => {
      const fileName = f.name.split('.').slice(0, -1).join('.').toLowerCase().trim();
      return fileName === name.toLowerCase().trim();
    });
  };

  const hasDuplicateName = (name: string) => {
    return previewData.filter(d => d.full_name?.toLowerCase().trim() === name.toLowerCase().trim()).length > 1;
  };

  const handleCommit = async () => {
    const validData = previewData.filter(d => d.isValid);
    if (validData.length === 0) return Swal.fire('Peringatan', 'Tidak ada data valid untuk diimpor.', 'warning');

    const confirm = await Swal.fire({
      title: 'Konfirmasi Impor',
      text: `Sistem akan memproses ${validData.length} baris data ${type === 'warning' ? 'peringatan' : 'pemberhentian'}. Lanjutkan?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: type === 'warning' ? '#006E62' : '#dc2626',
      confirmButtonText: 'Ya, Proses Sekarang'
    });

    if (confirm.isConfirmed) {
      try {
        setIsUploading(true);
        const dataToCommit = [...previewData];
        const rowsWithFiles = dataToCommit.filter(row => row.isValid && getMatchedFile(row.full_name));
        
        setUploadProgress({ current: 0, total: rowsWithFiles.length });

        // 1. Upload matched files to Drive
        for (let i = 0; i < dataToCommit.length; i++) {
          const row = dataToCommit[i];
          if (row.isValid) {
            const matchedFile = getMatchedFile(row.full_name);
            if (matchedFile) {
              const fileId = await googleDriveService.uploadFile(matchedFile);
              dataToCommit[i].file_id = fileId;
              setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }
          }
        }

        // 2. Commit to Database
        if (type === 'warning') {
          await disciplineService.commitWarningImport(dataToCommit);
        } else {
          await disciplineService.commitTerminationImport(dataToCommit);
        }

        Swal.fire('Berhasil!', `Seluruh data ${type === 'warning' ? 'SP' : 'Exit'} telah diperbarui.`, 'success');
        onSuccess();
      } catch (error) {
        console.error('Import error:', error);
        Swal.fire('Gagal', 'Terjadi kesalahan saat memproses data.', 'error');
      } finally {
        setIsUploading(false);
        setUploadProgress({ current: 0, total: 0 });
      }
    }
  };

  const getTemplateDownloadAction = () => {
    if (type === 'warning') return disciplineService.downloadWarningTemplate();
    return disciplineService.downloadTerminationTemplate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
      <div className="bg-white rounded-md shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className={`text-base font-bold ${type === 'warning' ? 'text-[#006E62]' : 'text-red-600'}`}>
              Impor Massal {type === 'warning' ? 'Riwayat SP' : 'Karyawan Keluar (Exit)'}
            </h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tahap {step}: {step === 1 ? 'Unggah File' : 'Pratinjau Data'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
              <div className="space-y-6 flex flex-col items-center text-center border-r border-gray-100 pr-8">
                <FileUp size={48} className={type === 'warning' ? 'text-[#006E62]' : 'text-red-600'} />
                <div className="max-w-md">
                  <h4 className="text-lg font-bold text-gray-800">1. Data Excel</h4>
                  <p className="text-xs text-gray-500 mt-2">
                    Gunakan template untuk mencatat data {type === 'warning' ? 'Surat Peringatan' : 'Exit/Resign'} secara massal.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button onClick={getTemplateDownloadAction} className="flex items-center justify-center gap-2 border border-gray-200 px-4 py-3 rounded-md hover:bg-gray-50 text-xs font-bold text-gray-600 uppercase">
                    <Download size={18} /> Download Template
                  </button>
                  <label className={`flex items-center justify-center gap-2 text-white px-4 py-3 rounded-md transition-colors shadow-md text-xs font-bold uppercase cursor-pointer ${type === 'warning' ? 'bg-[#006E62] hover:bg-[#005a50]' : 'bg-red-600 hover:bg-red-700'}`}>
                    {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <FileUp size={18} />}
                    {isProcessing ? 'Memproses...' : 'Unggah Excel'}
                    <input type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} disabled={isProcessing} />
                  </label>
                </div>
              </div>

              <div className="space-y-6 flex flex-col items-center text-center">
                <Paperclip size={48} className="text-gray-400" />
                <div className="max-w-md">
                  <h4 className="text-lg font-bold text-gray-800">2. Dokumen (Opsional)</h4>
                  <p className="text-xs text-gray-500 mt-2">
                    Unggah file PDF/Gambar. Namai file sesuai <b>Nama Karyawan</b> di Excel agar sistem dapat melakukan mapping otomatis.
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="mb-2 text-xs text-gray-500 font-bold uppercase">Pilih File Dokumen</p>
                      <p className="text-[10px] text-gray-400">{selectedFiles.length} file terpilih</p>
                    </div>
                    <input type="file" className="hidden" multiple accept="image/*,.pdf" onChange={handleDocFilesChange} />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-4 rounded border text-xs font-bold ${type === 'warning' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} /> Terbaca {previewData.length} baris. ({previewData.filter(d => d.isValid).length} Valid)
                </div>
                <button onClick={() => setStep(1)} className="uppercase hover:underline">Ganti File / Tambah Dokumen</button>
              </div>
              <div className="border border-gray-100 rounded overflow-x-auto text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 font-bold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Nama</th>
                      <th className="px-4 py-2">{type === 'warning' ? 'Tipe SP' : 'Tipe Exit'}</th>
                      <th className="px-4 py-2">Alasan</th>
                      <th className="px-4 py-2">{type === 'warning' ? 'Tgl SP' : 'Tgl Exit'}</th>
                      <th className="px-4 py-2">Dokumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {previewData.map((row, idx) => {
                      const matchedFile = getMatchedFile(row.full_name || '');
                      const isDuplicate = hasDuplicateName(row.full_name || '');
                      
                      return (
                        <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                          <td className="px-4 py-2">
                            {row.isValid ? (
                              <CheckCircle size={14} className="text-emerald-500" />
                            ) : (
                              <AlertTriangle size={14} className="text-red-500" />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{row.full_name}</span>
                              {isDuplicate && (
                                <div className="group relative">
                                  <AlertTriangle size={12} className="text-amber-500 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-xl z-10">
                                    Nama ganda terdeteksi. Pastikan file yang terlampir sudah sesuai.
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-2 uppercase font-bold ${type === 'warning' ? 'text-orange-600' : 'text-red-600'}`}>
                            <div className="flex items-center gap-2">
                              {type === 'warning' ? row.warning_type : row.termination_type}
                              {row.mitigationApplied && (
                                <div className="group relative">
                                  <Info size={12} className="text-blue-500 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-xl z-10">
                                    Sistem menyesuaikan nilai Pesangon/Penalti agar sesuai dengan tipe exit.
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 truncate max-w-xs">{row.reason}</td>
                          <td className="px-4 py-2">{type === 'warning' ? row.issue_date : row.termination_date}</td>
                          <td className="px-4 py-2">
                            {matchedFile ? (
                              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                <Paperclip size={12} /> {matchedFile.name.length > 15 ? matchedFile.name.substring(0, 12) + '...' : matchedFile.name}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">Tidak ada file</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Batal</button>
          {step === 2 && (
            <button 
              onClick={handleCommit} 
              disabled={isUploading} 
              className={`flex items-center gap-2 text-white px-8 py-2 rounded shadow-md transition-all text-xs font-bold uppercase disabled:opacity-50 ${type === 'warning' ? 'bg-[#006E62] hover:bg-[#005a50]' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
              {isUploading 
                ? `Mengunggah (${uploadProgress.current}/${uploadProgress.total})...` 
                : 'Simpan Seluruh Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisciplineImportModal;
