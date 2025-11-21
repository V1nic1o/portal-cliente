import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { CreditCard, Upload, CheckCircle, Copy, Loader2, ArrowRight } from 'lucide-react'; // Iconos nuevos
import { useSearchParams } from 'react-router-dom';

export default function ClientDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [redirecting, setRedirecting] = useState(false); // Nuevo estado para feedback visual
  const [searchParams] = useSearchParams();

  // Datos del formulario
  const [productId, setProductId] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  const [isForcedPayment, setIsForcedPayment] = useState(false);

  useEffect(() => {
    const initializeDashboard = async () => {
      // 1. Detectar si viene de una URL de cobro (Deep Link)
      const urlProduct = searchParams.get('pay');
      const urlAmount = searchParams.get('amount');

      if (urlProduct && urlAmount) {
        setProductId(urlProduct);
        setAmount(urlAmount);
        setIsForcedPayment(true);
      }

      try {
        // 2. Consultar el estado al Backend
        const res = await api.get('/api/v1/user/status');
        setStatus(res.data);

        // ---> LÓGICA DE SEMÁFORO <---
        
        // CASO 1: YA ESTÁ ACTIVO -> REDIRECCIÓN AUTOMÁTICA
        if (res.data.subscription_status === 'ACTIVE') {
           const returnUrl = sessionStorage.getItem('return_url');
           
           if (returnUrl) {
             setRedirecting(true);
             toast.success('Suscripción activa. Redirigiendo...');
             
             // Pequeño delay para que el usuario lea el mensaje
             setTimeout(() => {
               const token = localStorage.getItem('client_token');
               // Enviamos al usuario de vuelta a la App externa con su token
               window.location.href = `${returnUrl}?token=${token}`;
             }, 2000);
           }
        }

        // Pre-llenado de producto si existe en el historial
        if (!urlProduct && res.data.product_id && res.data.product_id !== 'not_set') {
          setProductId(res.data.product_id);
        }
      } catch (error) {
        console.log("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !productId || !amount) return toast.error('Faltan datos.');

    setUploading(true);
    const formData = new FormData();
    formData.append('product_id', productId);
    formData.append('amount', amount);
    formData.append('proof_file', file);

    try {
      await api.post('/api/v1/payment/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('Comprobante recibido.');
      setFile(null);
      
      // RECARGAMOS EL ESTADO INMEDIATAMENTE
      // Esto forzará a que aparezca la pantalla de "Procesando" sin recargar la página
      setLoading(true);
      const res = await api.get('/api/v1/user/status');
      setStatus(res.data);
      setLoading(false);

    } catch (error) {
      console.error(error);
      toast.error('Error al subir el comprobante.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p>Cargando información...</p>
    </div>
  );

  // ---------------------------------------------------------------------------
  // VISTA 1: REDIRECCIONANDO (Suscripción Activa + return_url)
  // ---------------------------------------------------------------------------
  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-green-100">
           <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
             <ArrowRight className="w-8 h-8 text-green-600 animate-pulse" />
           </div>
           <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso Concedido</h1>
           <p className="text-gray-500">Te estamos redirigiendo a tu aplicación...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA 2: EN ESPERA / PROCESANDO (Pago enviado pero no aprobado)
  // ---------------------------------------------------------------------------
  // Nota: Para que esto persista al recargar (F5), tu backend debe enviar "has_pending_payment": true
  // Si no, solo funcionará justo después de subir la foto.
  if (status?.has_pending_payment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4 text-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Pago en Proceso</h1>
          <p className="text-gray-600 leading-relaxed mb-6">
            Hemos recibido tu comprobante correctamente. <br/>
            Nuestro equipo está validando la transferencia.
          </p>
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
            📧 Te notificaremos por correo cuando tu acceso esté listo.
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 text-sm text-gray-400 hover:text-blue-600 underline"
          >
            Comprobar estado ahora
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA 3: FORMULARIO DE PAGO (Suscripción Inactiva/Expirada y sin pagos pendientes)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {isForcedPayment ? 'Completar Pago' : 'Mi Portal'}
          </h1>
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="text-sm text-red-500 hover:underline">Cerrar Sesión</button>
        </div>

        {/* Alerta de Estado (Solo visible si está activo pero sin return_url, o expirado) */}
        {status && status.subscription_status === 'ACTIVE' ? (
             <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
                <CheckCircle className="w-5 h-5" />
                <div>
                  <p className="font-bold">Suscripción Activa</p>
                  <p className="text-xs">Vence el: {status.expiration_date}</p>
                </div>
             </div>
        ) : status && (
             <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                <p className="font-bold">Estado: {status.subscription_status}</p>
                <p className="text-sm">Realiza tu pago para reactivar el servicio.</p>
             </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          
          {/* TARJETA DE INFORMACIÓN BANCARIA */}
          <div className="bg-blue-600 text-white rounded-xl shadow-lg p-6 flex flex-col justify-between relative overflow-hidden">
            {/* Decoración de fondo */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            
            <div>
              <div className="flex items-center gap-2 mb-6 opacity-90">
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold tracking-widest uppercase">Datos de Transferencia</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-blue-200 uppercase font-medium">Banco</p>
                  <p className="text-lg font-bold">Banrural (Ahorro)</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200 uppercase font-medium">Beneficiario</p>
                  <p className="text-base font-medium">Erick Vinicio Valdez Cruz</p>
                </div>
                <div>
                   <p className="text-xs text-blue-200 uppercase font-medium mb-1">No. de Cuenta</p>
                   <div className="flex items-center gap-2 bg-black/20 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                      <span className="text-xl font-mono tracking-widest flex-1">4526079531</span>
                      <button onClick={() => copyToClipboard('4526079531')} className="p-1.5 hover:bg-white/20 rounded transition" title="Copiar">
                        <Copy className="w-4 h-4" />
                      </button>
                   </div>
                </div>
              </div>
            </div>

            {isForcedPayment && (
              <div className="mt-6 pt-4 border-t border-white/20">
                <p className="text-xs text-blue-200 uppercase tracking-wider font-medium text-center">Total a Pagar</p>
                <p className="text-4xl font-bold mt-1 text-center">Q{amount}</p>
              </div>
            )}
          </div>

          {/* FORMULARIO DE SUBIDA */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" /> 
              <span>Confirmar Transferencia</span>
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {!isForcedPayment && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Producto ID</label>
                    <input 
                      type="text" 
                      required
                      className="w-full rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      placeholder="Ej. app_taller"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Monto (Q)</label>
                    <input 
                      type="number" 
                      required
                      className="w-full rounded-lg bg-gray-50 border border-gray-200 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div className={`border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer hover:bg-gray-50 group relative ${file ? 'border-green-400 bg-green-50/30' : 'border-gray-300'}`}>
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => setFile(e.target.files[0])}
                  accept="image/*"
                />
                
                <div className="text-center">
                  {file ? (
                    <div className="animate-fade-in">
                      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[200px] mx-auto">{file.name}</p>
                      <p className="text-xs text-green-600 mt-1">Clic para cambiar</p>
                    </div>
                  ) : (
                    <div className="group-hover:scale-105 transition-transform">
                      <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                        <Upload className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Sube la foto del recibo</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG o PDF</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !file}
                className={`w-full py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition-all transform active:scale-95 flex items-center justify-center gap-2 ${uploading || !file ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  'ENVIAR COMPROBANTE'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}