import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut, Search, Download, FileUp, UserCircle, Plus, Trash2, ArrowRight, Edit2, X, Info } from 'lucide-react';
import Swal from 'sweetalert2';
import { disciplineService } from '../../services/disciplineService';
import { googleDriveService } from '../../services/googleDriveService';
import { WarningLogExtended, TerminationLogExtended } from '../../types';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import DisciplineImportModal from './DisciplineImportModal';
import WarningDetailModal from '../account/WarningDetailModal';
import TerminationDetailModal from '../account/TerminationDetailModal';
import WarningForm from './WarningForm';
import TerminationForm from './TerminationForm';

const DisciplineMain: React.FC = () => {
  const [warnings, setWarnings] = useState<WarningLogExtended[]>([]);
  const [terminations, setTerminations] = useState<TerminationLogExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'warnings' | 'terminations'>('warnings');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'warning' | 'termination'>('warning');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedWarning, setSelectedWarning] = useState<WarningLogExtended | null>(null);
  const [editingWarning, setEditingWarning] = useState<WarningLogExtended | null>(null);
  const [selectedTermination, setSelectedTermination] = useState<TerminationLogExtended | null>(null);
  const [editingTermination, setEditingTermination] = useState<TerminationLogExtended | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [w, t] = await Promise.all([
        disciplineService.getWarningsAll(),
        disciplineService.getTerminationsAll()
      ]);
      setWarnings(w);
      setTerminations(t);
    } catch (error) {
      Swal.fire('Gagal', 'Gagal memuat data kedisiplinan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWarning = async (id: string) => {
    const res = await Swal.fire({ 
      title: 'Hapus log peringatan?', 
      text: "Data ini akan dihapus permanen dari sistem.",
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (res.isConfirmed) {
      try {
        setIsLoading(true);
        await disciplineService.deleteWarning(id);
        setWarnings(prev => prev.filter(w => w.id !== id));
        setSelectedIds(prev => prev.filter(sid => sid !== id));
        Swal.fire('Terhapus', 'Log peringatan telah dihapus.', 'success');
      } catch (e) { 
        Swal.fire('Gagal', 'Gagal menghapus log', 'error'); 
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteTermination = async (id: string, accountId: string) => {
    const res = await Swal.fire({ 
      title: 'Hapus log pengakhiran?', 
      text: "Data ini akan dihapus permanen dari sistem.",
      icon: 'warning', 
      showCancelButton: true, 
      confirmButtonColor: '#ef4444', 
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });
    if (res.isConfirmed) {
      try {
        setIsLoading(true);
        await disciplineService.deleteTermination(id, accountId);
        setTerminations(prev => prev.filter(t => t.id !== id));
        setSelectedIds(prev => prev.filter(sid => sid !== id));
        Swal.fire('Terhapus', 'Log pengakhiran telah dihapus.', 'success');
      } catch (e) { 
        Swal.fire('Gagal', 'Gagal menghapus log', 'error'); 
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const result = await Swal.fire({
      title: 'Hapus Masal?',
      text: `Apakah Anda yakin ingin menghapus ${selectedIds.length} data terpilih secara permanen?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, Hapus Semua',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        setIsLoading(true);
        if (activeTab === 'warnings') {
          await disciplineService.bulkDeleteWarnings(selectedIds);
          setWarnings(prev => prev.filter(w => !selectedIds.includes(w.id)));
        } else {
          const itemsToDelete = terminations
            .filter(t => selectedIds.includes(t.id))
            .map(t => ({ id: t.id, account_id: t.account_id }));
          await disciplineService.bulkDeleteTerminations(itemsToDelete);
          setTerminations(prev => prev.filter(t => !selectedIds.includes(t.id)));
        }
        setSelectedIds([]);
        Swal.fire('Berhasil!', 'Data terpilih telah dihapus.', 'success');
      } catch (error) {
        Swal.fire('Gagal', 'Beberapa data mungkin gagal dihapus.', 'error');
        fetchData();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentList = activeTab === 'warnings' ? filteredWarnings : filteredTerminations;
    if (selectedIds.length === currentList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentList.map(item => item.id));
    }
  };

  const handleTabChange = (tab: 'warnings' | 'terminations') => {
    setActiveTab(tab);
    setSelectedIds([]);
  };

  const filteredWarnings = warnings.filter(w => 
    `${w.account?.full_name} ${w.account?.internal_nik} ${w.warning_type} ${w.reason}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTerminations = terminations.filter(t => 
    `${t.account?.full_name} ${t.account?.internal_nik} ${t.termination_type} ${t.reason}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-gray-50 p-1 rounded-md border border-gray-100">
          <button 
            onClick={() => handleTabChange('warnings')}
            className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded ${activeTab === 'warnings' ? 'bg-white text-[#006E62] shadow-sm' : 'text-gray-400'}`}
          >
            Peringatan (SP)
          </button>
          <button 
            onClick={() => handleTabChange('terminations')}
            className={`px-4 py-2 text-xs font-bold uppercase transition-all rounded ${activeTab === 'terminations' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}
          >
            Karyawan Keluar (Exit)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-md border border-red-100 hover:bg-red-100 transition-all text-sm font-medium mr-2"
            >
              <Trash2 size={18} /> Hapus ({selectedIds.length})
            </button>
          )}
          {activeTab === 'warnings' ? (
            <button onClick={() => { setImportType('warning'); setShowImportModal(true); }} className="flex items-center gap-2 bg-[#006E62] text-white px-4 py-2 rounded-md hover:bg-[#005a50] text-xs font-bold uppercase transition-all shadow-sm">
              <FileUp size={16} /> IMPOR MASSAL
            </button>
          ) : (
            <button onClick={() => { setImportType('termination'); setShowImportModal(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-xs font-bold uppercase transition-all shadow-sm">
              <FileUp size={16} /> IMPOR MASSAL
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <ShieldAlert className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Cari data..."
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#006E62] text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-md overflow-hidden shadow-sm">
        {activeTab === 'warnings' ? (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-[#006E62] focus:ring-[#006E62]"
                    checked={selectedIds.length === filteredWarnings.length && filteredWarnings.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Jenis Peringatan</th>
                <th className="px-6 py-4">Alasan</th>
                <th className="px-6 py-4">Tgl Terbit</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? <tr><td colSpan={6} className="py-20 text-center text-gray-400">Memuat...</td></tr> : filteredWarnings.map(w => {
                const isSelected = selectedIds.includes(w.id);
                return (
                  <tr 
                    key={w.id} 
                    className={`hover:bg-gray-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-50/20' : ''}`}
                    onClick={() => setSelectedWarning(w)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-[#006E62] focus:ring-[#006E62]"
                        checked={isSelected}
                        onChange={() => toggleSelect(w.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-200 overflow-hidden">
                          {w.account?.photo_google_id ? (
                            <img 
                              src={googleDriveService.getFileUrl(w.account.photo_google_id)} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserCircle size={20} />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-800">{w.account?.full_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{w.account?.internal_nik}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-600 uppercase">{w.warning_type}</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate">{w.reason}</td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{formatDate(w.issue_date)}</td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingWarning(w)}
                          className="p-1.5 text-[#006E62] hover:bg-emerald-50 rounded transition-colors"
                          title="Edit Peringatan"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteWarning(w.id)} 
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                          title="Hapus Peringatan"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300 text-[#006E62] focus:ring-[#006E62]"
                    checked={selectedIds.length === filteredTerminations.length && filteredTerminations.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4">Karyawan</th>
                <th className="px-6 py-4">Tipe Exit</th>
                <th className="px-6 py-4">Tgl Berhenti</th>
                <th className="px-6 py-4">Alasan</th>
                <th className="px-6 py-4">Keuangan</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? <tr><td colSpan={7} className="py-20 text-center text-gray-400">Memuat...</td></tr> : filteredTerminations.map(t => {
                const isSelected = selectedIds.includes(t.id);
                return (
                  <tr 
                    key={t.id} 
                    className={`hover:bg-gray-50/50 transition-colors cursor-pointer border-l-2 border-l-red-500 ${isSelected ? 'bg-red-50/20' : 'bg-red-50/5'}`}
                    onClick={() => setSelectedTermination(t)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-[#006E62] focus:ring-[#006E62]"
                        checked={isSelected}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center border border-gray-200 overflow-hidden">
                          {t.account?.photo_google_id ? (
                            <img 
                              src={googleDriveService.getFileUrl(t.account.photo_google_id)} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserCircle size={20} />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-800">{t.account?.full_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{t.account?.internal_nik}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-600 uppercase">{t.termination_type}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{formatDate(t.termination_date)}</td>
                    <td className="px-6 py-4 text-xs text-gray-600 max-w-xs truncate italic">"{t.reason}"</td>
                    <td className="px-6 py-4">
                      <div className="text-[10px] font-bold text-gray-700">
                        {t.termination_type === 'Pemecatan / PHK' ? `Pesangon: ${formatCurrency(t.severance_amount)}` : `Penalti: ${formatCurrency(t.penalty_amount)}`}
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingTermination(t)}
                          className="p-1.5 text-[#006E62] hover:bg-emerald-50 rounded transition-colors"
                          title="Edit Pengakhiran"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteTermination(t.id, t.account_id)} 
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                          title="Hapus Pengakhiran"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showImportModal && (
        <DisciplineImportModal 
          type={importType}
          onClose={() => setShowImportModal(false)} 
          onSuccess={() => { setShowImportModal(false); fetchData(); }} 
        />
      )}

      {/* Warning Detail Modal */}
      {selectedWarning && (
        <WarningDetailModal 
          log={selectedWarning} 
          onClose={() => setSelectedWarning(null)} 
          onEdit={() => {
            const data = selectedWarning;
            setSelectedWarning(null);
            setEditingWarning(data);
          }}
        />
      )}

      {/* Warning Edit Modal */}
      {editingWarning && (
        <WarningForm 
          accountId={editingWarning.account_id} 
          initialData={editingWarning}
          onClose={() => setEditingWarning(null)} 
          onSuccess={() => { setEditingWarning(null); fetchData(); }} 
        />
      )}

      {/* Termination Detail Modal */}
      {selectedTermination && (
        <TerminationDetailModal 
          log={selectedTermination} 
          onClose={() => setSelectedTermination(null)} 
          onEdit={() => {
            const data = selectedTermination;
            setSelectedTermination(null);
            setEditingTermination(data);
          }}
        />
      )}

      {/* Termination Edit Modal */}
      {editingTermination && (
        <TerminationForm 
          accountId={editingTermination.account_id} 
          initialData={editingTermination}
          onClose={() => setEditingTermination(null)} 
          onSuccess={() => { setEditingTermination(null); fetchData(); }} 
        />
      )}
    </div>
  );
};

export default DisciplineMain;