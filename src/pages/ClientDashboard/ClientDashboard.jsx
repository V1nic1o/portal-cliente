import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { CreditCard, Upload, CheckCircle, Copy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function ClientDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();

  // Datos del formulario
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  
  // Estado para saber si ocultamos los campos
  const [isForcedPayment, setIsForcedPayment] = useState(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      // 1. Lógica de URL (Deep Linking) - SE EJECUTA PRIMERO Y SIEMPRE
      const urlProduct = searchParams.get('pay');
      const urlAmount = searchParams.get('amount');

      if (urlProduct && urlAmount) {
        setProductId(urlProduct);
        setAmount(urlAmount);
        setIsForcedPayment(true); // Ocultamos campos inmediatamente
      }

      // 2. Intentar obtener estado del usuario (API)
      try {
        const res = await api.get('/api/v1/user/status');
        setStatus(res.data);
        
        // Si NO hay URL params, y el usuario ya tiene producto (Renovación), pre-llenamos
        if (!urlProduct && res.data.product_id && res.data.product_id !== 'not_set') {
          setProductId(res.data.product_id);
        }
      } catch (error) {
        // Si da 401 o 404, es normal en usuarios nuevos. No hacemos nada, solo logueamos.
        console.log("Usuario sin estatus activo o error de conexión:", error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [searchParams]);

  // 3. Subir comprobante
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !productId || !amount) {
      toast.error('Falta el comprobante o datos del pago.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('amount', amount);
    formData.append('proof_file', file);

    try {
      await api.post('/api/v1/payment/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('¡Comprobante enviado! Validando pago...');
      setFile(null);

    } catch (error) {
      console.error(error);
      toast.error('Error al subir el comprobante.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {isForcedPayment ? 'Completar Pago' : 'Mi Cuenta'}
          </h1>
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="text-sm text-red-500 hover:underline">Salir</button>
        </div>

        {/* Tarjeta de Estatus (Solo visible si hay status válido) */}
        {status && !isForcedPayment && (
             <div className={`p-4 rounded-lg border ${status.subscription_status === 'ACTIVE' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                <p className="font-bold">Estado: {status.subscription_status}</p>
                {status.days_remaining > 0 && <p>Días restantes: {status.days_remaining}</p>}
             </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          
          {/* 1. Información Bancaria */}
          <div className="bg-blue-600 text-white rounded-xl shadow-lg p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 opacity-90">
                <CreditCard className="w-5 h-5" />
                <span className="text-sm font-medium tracking-wide">DATOS PARA TRANSFERENCIA</span>
              </div>
              <p className="text-sm text-blue-100 mb-1">Banco</p>
              <p className="text-xl font-bold mb-4">Banrural (Ahorro)</p>
              <p className="text-sm text-blue-100 mb-1">A nombre de</p>
              <p className="font-medium mb-4">Erick Vinicio Valdez Cruz</p>
              <p className="text-sm text-blue-100 mb-1">Número de Cuenta</p>
              <div className="flex items-center gap-3 bg-blue-700/50 p-3 rounded-lg border border-blue-500/30">
                <span className="text-2xl font-mono tracking-wider">4526079531</span>
                <button onClick={() => copyToClipboard('4526079531')} className="p-2 hover:bg-blue-600 rounded transition">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Si el monto viene predefinido, lo mostramos grande aquí */}
            {isForcedPayment && (
              <div className="mt-6 bg-white/10 p-3 rounded-lg text-center animate-fade-in border border-white/20">
                <p className="text-sm text-blue-100 uppercase tracking-wider font-medium">Monto a Transferir</p>
                <p className="text-4xl font-bold mt-1">Q{amount}</p>
                <p className="text-xs text-blue-200 mt-2">Producto: {productId}</p>
              </div>
            )}
          </div>

          {/* 2. Formulario de Subida */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> Subir Comprobante
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Solo mostramos inputs si NO es un pago forzado por URL */}
              {!isForcedPayment && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
                    <input 
                      type="text" 
                      className="w-full rounded-lg bg-gray-50 border-gray-200 border p-2 text-sm text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      placeholder="Ej. premium_v1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Monto (Q)</label>
                    <input 
                      type="number" 
                      className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Ej. 150"
                    />
                  </div>
                </>
              )}

              <div className="mt-2">
                <div className={`flex justify-center px-6 pt-8 pb-8 border-2 border-dashed rounded-xl hover:bg-gray-50 transition cursor-pointer relative ${file ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}>
                  <div className="space-y-2 text-center">
                    {file ? (
                      <div className="text-green-700 font-medium text-sm flex flex-col items-center animate-fade-in">
                        <CheckCircle className="w-10 h-10 mb-2 text-green-600" />
                        <span className="break-all font-semibold">{file.name}</span>
                        <span className="text-xs text-green-600 mt-1">Clic para cambiar imagen</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-10 w-10 text-gray-400" />
                        <div className="text-sm text-gray-600 font-medium">Toca para subir la foto</div>
                        <p className="text-xs text-gray-400">Transferencia o Depósito</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => setFile(e.target.files[0])}
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !file}
                className={`w-full py-3 px-4 rounded-lg shadow-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition transform active:scale-95 ${uploading || !file ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {uploading ? 'Enviando...' : 'CONFIRMAR PAGO'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}