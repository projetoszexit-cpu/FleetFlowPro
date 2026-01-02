
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getFleetStatsAnalysis } from '../services/geminiService';
import { VehicleStatus, OccurrenceSeverity, Trip, MaintenanceRecord } from '../types';

interface DashboardOverviewProps {
  onStartSchedule?: (id: string) => void;
  onNavigate?: (tab: string) => void; 
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onStartSchedule, onNavigate }) => {
  const { vehicles, drivers, activeTrips, scheduledTrips, notifications, checklists, occurrences, maintenanceRecords, currentUser, updateTrip, endTrip, cancelTrip, resolveMaintenance } = useFleet();
  const [aiInsights, setAiInsights] = useState<string>("Analisando dados da frota...");
  
  const isAdmin = currentUser?.username === 'admin';
  const myActiveTrip = useMemo(() => activeTrips.find(t => t.driverId === currentUser?.id), [activeTrips, currentUser]);
  
  const myScheduledTrips = useMemo(() => {
    return scheduledTrips
      .filter(t => t.driverId === currentUser?.id)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, currentUser]);

  const [resolvingMaint, setResolvingMaint] = useState<{recordId: string, vehicleId: string, plate: string} | null>(null);
  const [resKm, setResKm] = useState<number>(0);
  
  // Finish Trip States
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endKm, setEndKm] = useState<number>(0);
  const [fuelExpense, setFuelExpense] = useState<string>('0');
  const [otherExpense, setOtherExpense] = useState<string>('0');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const vehiclesInMaintenance = useMemo(() => {
    return vehicles.filter(v => v.status === VehicleStatus.MAINTENANCE).map(v => {
      const activeM = maintenanceRecords.find(m => m.vehicleId === v.id && !m.returnDate);
      return { ...v, activeMaintenanceId: activeM?.id };
    });
  }, [vehicles, maintenanceRecords]);

  const fleetStats = useMemo(() => {
    const total = vehicles.length || 1;
    const available = vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length;
    const inUse = vehicles.filter(v => v.status === VehicleStatus.IN_USE).length;
    const maintenance = vehicles.filter(v => v.status === VehicleStatus.MAINTENANCE).length;

    return {
      available, inUse, maintenance, total: vehicles.length,
      pAvailable: (available / total * 100).toFixed(0),
      pInUse: (inUse / total * 100).toFixed(0),
      pMaintenance: (maintenance / total * 100).toFixed(0)
    };
  }, [vehicles]);

  const handleResolveMaintQuick = () => {
    if (resolvingMaint) {
      resolveMaintenance(resolvingMaint.vehicleId, resolvingMaint.recordId, resKm, new Date().toISOString());
      setResolvingMaint(null);
      alert(`Veículo ${resolvingMaint.plate} liberado para uso!`);
    }
  };

  const handleFinalArrival = () => {
    if (myActiveTrip) {
      const vehicle = vehicles.find(v => v.id === myActiveTrip.vehicleId);
      setEndKm(vehicle?.currentKm || 0);
      setFuelExpense('0');
      setOtherExpense('0');
      setExpenseNotes('');
      setShowFinishModal(true);
    }
  };

  const handleStartGPS = () => {
    if (!myActiveTrip) return;
    const origin = encodeURIComponent(myActiveTrip.origin);
    const dest = encodeURIComponent(`${myActiveTrip.destination}${myActiveTrip.city ? ', ' + myActiveTrip.city : ''}`);
    const wps = myActiveTrip.waypoints && myActiveTrip.waypoints.length > 0 
      ? `&waypoints=${myActiveTrip.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
      : '';
    
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps}&travelmode=driving`, '_blank');
  };

  const confirmFinish = () => {
    if (myActiveTrip) {
      const deviceTime = new Date().toISOString();
      endTrip(myActiveTrip.id, endKm, deviceTime, {
        fuel: parseFloat(fuelExpense) || 0,
        other: parseFloat(otherExpense) || 0,
        notes: expenseNotes
      });
      setShowFinishModal(false);
      alert('Viagem encerrada! Obrigado pela jornada.');
    }
  };

  const getStatusConfig = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.AVAILABLE:
        return { icon: 'fa-check-circle', color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Disponível' };
      case VehicleStatus.IN_USE:
        return { icon: 'fa-truck-moving', color: 'text-blue-500', bg: 'bg-blue-50', label: 'Em Uso' };
      case VehicleStatus.MAINTENANCE:
        return { icon: 'fa-wrench', color: 'text-red-500', bg: 'bg-red-50', label: 'Manutenção' };
      default:
        return { icon: 'fa-question-circle', color: 'text-slate-400', bg: 'bg-slate-50', label: 'Desconhecido' };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Geral</h2>
          <p className="text-xs text-slate-400 font-medium">Bem-vindo, {currentUser?.name}.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
            {isAdmin ? 'Gestão Master' : 'Painel do Condutor'}
          </span>
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-500">
           {/* Widget de Ações Rápidas Admin */}
           <div className="bg-white p-8 rounded-3xl border border-blue-100 shadow-xl shadow-blue-50/50 flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-6">
                 <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-200">
                   <i className="fas fa-users-gear"></i>
                 </div>
                 <div>
                   <h3 className="text-lg font-write text-slate-800 uppercase tracking-tight">Recursos Humanos</h3>
                   <p className="text-xs text-slate-400 font-medium">Controle total sobre o corpo de condutores.</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={() => onNavigate?.('drivers')}
                  className="bg-slate-900 text-white py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                   <i className="fas fa-user-plus"></i> Novo Motorista
                 </button>
                 <button 
                  onClick={() => onNavigate?.('drivers')}
                  className="bg-blue-50 text-blue-600 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-blue-100 transition-all border border-blue-100 flex items-center justify-center gap-2"
                >
                   <i className="fas fa-gavel"></i> Registrar Multa
                 </button>
              </div>
           </div>

           {/* Alertas de Oficina */}
           <div className={`p-8 rounded-3xl border transition-all ${vehiclesInMaintenance.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-sm font-write uppercase tracking-widest flex items-center gap-2 ${vehiclesInMaintenance.length > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                  <i className={`fas fa-wrench ${vehiclesInMaintenance.length > 0 ? 'animate-bounce' : ''}`}></i> 
                  Oficina: {vehiclesInMaintenance.length} Veículos
                </h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {vehiclesInMaintenance.length > 0 ? vehiclesInMaintenance.map(v => (
                  <button 
                    key={v.id}
                    onClick={() => {
                      setResolvingMaint({ recordId: v.activeMaintenanceId || '', vehicleId: v.id, plate: v.plate });
                      setResKm(v.currentKm);
                    }}
                    className="bg-white px-4 py-2.5 rounded-xl text-[10px] font-write uppercase tracking-widest shadow-sm border border-amber-100 hover:bg-amber-100 transition-all"
                  >
                    Liberar {v.plate}
                  </button>
                )) : (
                  <p className="text-xs text-slate-300 italic font-medium">Toda a frota está em operação ou disponível.</p>
                )}
              </div>
           </div>
        </div>
      )}

      {/* Seção de Viagem Ativa para o Motorista */}
      {!isAdmin && myActiveTrip && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 overflow-hidden relative group">
          <div className="absolute top-4 right-4 flex gap-2">
            <span className="bg-emerald-500 text-white text-[10px] font-write px-2 py-1 rounded-full animate-pulse flex items-center gap-1">
              <i className="fas fa-satellite-dish"></i> EM ROTA
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">
                  <i className="fas fa-truck-moving"></i>
                </div>
                <div>
                  <h3 className="text-lg font-write uppercase tracking-tight">Viagem Ativa</h3>
                  <p className="text-blue-400 text-xs font-bold">{vehicles.find(v => v.id === myActiveTrip.vehicleId)?.plate} • {vehicles.find(v => v.id === myActiveTrip.vehicleId)?.model}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Destino</p>
                  <p className="text-sm font-bold truncate">{myActiveTrip.destination}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-write mb-1">Início em</p>
                  <span className="text-sm font-bold">{new Date(myActiveTrip.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 flex flex-col gap-3 justify-center">
              <button 
                onClick={handleStartGPS}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-write text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 border-2 border-indigo-400/30"
              >
                <i className="fas fa-compass text-xl"></i> Navegação GPS
              </button>

              <button 
                onClick={handleFinalArrival}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-write text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/40"
              >
                <i className="fas fa-check-circle mr-2"></i> Cheguei ao Local
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOVA SEÇÃO: Agenda / Viagens Agendadas para o Motorista */}
      {!isAdmin && !myActiveTrip && myScheduledTrips.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-indigo-100 animate-in slide-in-from-left-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-write text-indigo-900 uppercase tracking-[0.2em] flex items-center gap-2">
              <i className="fas fa-calendar-check"></i> Próximas Viagens Agendadas
            </h3>
            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              {myScheduledTrips.length} Agendamentos
            </span>
          </div>
          
          <div className="space-y-4">
            {myScheduledTrips.map(trip => {
              const vehicle = vehicles.find(v => v.id === trip.vehicleId);
              const tripDate = new Date(trip.scheduledDate + 'T00:00:00');
              
              return (
                <div key={trip.id} className="group bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-center gap-6 hover:border-indigo-200 transition-all">
                  <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 flex flex-col items-center justify-center shadow-sm shrink-0">
                    <span className="text-xl font-write text-indigo-600 leading-none">{tripDate.getDate()}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {tripDate.toLocaleDateString('pt-BR', { month: 'short' })}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-write bg-slate-900 text-white px-2 py-0.5 rounded tracking-widest">{vehicle?.plate}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 truncate mb-1">{trip.destination}</h4>
                    <p className="text-[10px] text-slate-400 font-medium truncate italic">{trip.origin || 'Base / Garagem'} <i className="fas fa-arrow-right mx-1"></i> {trip.city}</p>
                  </div>
                  
                  <button 
                    onClick={() => onStartSchedule?.(trip.id)}
                    className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                  >
                    Iniciar Jornada <i className="fas fa-play text-[8px]"></i>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Caso não tenha nenhuma atividade para o motorista */}
      {!isAdmin && !myActiveTrip && myScheduledTrips.length === 0 && (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center">
           <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
             <i className="fas fa-calendar-day text-3xl"></i>
           </div>
           <h3 className="text-lg font-write text-slate-800 uppercase tracking-tight">Tudo em Ordem</h3>
           <p className="text-xs text-slate-400 font-medium">Você não possui viagens ativas ou agendamentos para o momento.</p>
        </div>
      )}

      {/* Estatísticas Rápidas (Abaixo dos destaques) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Veículos Disponíveis</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{fleetStats.available}</span>
             <i className="fas fa-check-circle text-emerald-500 text-2xl opacity-20"></i>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Frota em Operação</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{fleetStats.inUse}</span>
             <i className="fas fa-truck-fast text-blue-500 text-2xl opacity-20"></i>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <p className="text-[10px] font-write text-slate-400 uppercase mb-2 tracking-widest">Motoristas Livres</p>
           <div className="flex items-center justify-between">
             <span className="text-3xl font-write text-slate-800">{drivers.length - fleetStats.inUse}</span>
             <i className="fas fa-users text-indigo-500 text-2xl opacity-20"></i>
           </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-satellite text-blue-500"></i> Localização & Status da Frota
          </h3>
          <span className="text-[10px] font-bold text-slate-300 uppercase">Total: {vehicles.length} Ativos</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {vehicles.map(v => {
            const config = getStatusConfig(v.status);
            return (
              <div key={v.id} className={`${config.bg} p-4 rounded-2xl border border-white shadow-sm flex flex-col items-center text-center transition-all hover:scale-105 group`}>
                <div className={`${config.color} text-xl mb-2 transition-transform group-hover:rotate-12`}>
                  <i className={`fas ${config.icon}`}></i>
                </div>
                <p className="text-xs font-write text-slate-800 uppercase tracking-tighter truncate w-full">{v.plate}</p>
                <span className={`${config.color} text-[8px] font-write uppercase tracking-widest`}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Finalizar Viagem */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-lg font-write uppercase tracking-tight">Encerrar Jornada</h3>
              <button onClick={() => setShowFinishModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="p-8 space-y-6">
               <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3">KM Atual no Painel</label>
                <input 
                  type="number"
                  value={endKm}
                  onChange={(e) => setEndKm(parseInt(e.target.value))}
                  className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-write text-2xl text-slate-800 text-center"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Abastecimento (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={fuelExpense}
                    onChange={(e) => setFuelExpense(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Outras (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={otherExpense}
                    onChange={(e) => setOtherExpense(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowFinishModal(false)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Voltar</button>
                <button onClick={confirmFinish} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-emerald-100">Confirmar Fim</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Liberar Veículo da Manutenção */}
      {resolvingMaint && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
              <h3 className="text-lg font-write uppercase tracking-tight">Liberar Veículo: {resolvingMaint.plate}</h3>
              <button onClick={() => setResolvingMaint(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3">KM Atual de Retorno</label>
                <input 
                  type="number"
                  required
                  value={resKm}
                  onChange={(e) => setResKm(parseInt(e.target.value))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-write text-2xl text-slate-800 text-center"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setResolvingMaint(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px]">Cancelar</button>
                <button onClick={handleResolveMaintQuick} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-emerald-100">Confirmar Retorno</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
