import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Verificar si ya hay sesión
    const token = localStorage.getItem('client_token');
    if (token) {
      // Aquí podrías llamar a un endpoint /me para validar el token, 
      // por ahora asumimos que si está ahí, es válido.
      setUser({ token }); 
    }

    // 2. LÓGICA DE REDIRECCIÓN (SSO)
    // Si la URL trae un ?return_url=https://otra-app.com, lo guardamos para usarlo después.
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('return_url');
    if (returnUrl) {
      sessionStorage.setItem('return_url', returnUrl);
    }

    setLoading(false);
  }, []);

  // Función auxiliar para redirigir después de autenticarse
  const handleRedirect = (token) => {
    const returnUrl = sessionStorage.getItem('return_url');
    
    if (returnUrl) {
      // Si venía de otra app, lo devolvemos con el token en la URL
      // Limpiamos la url guardada
      sessionStorage.removeItem('return_url');
      window.location.href = `${returnUrl}?token=${token}`;
    } else {
      // Si entró directo, lo mandamos a su dashboard interno
      window.location.href = '/dashboard'; 
    }
  };

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token } = res.data;
      
      localStorage.setItem('client_token', token);
      setUser({ token });
      handleRedirect(token); // <--- Redirección inteligente
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (email, password) => {
    try {
      await api.post('/auth/register', { email, password });
      // Después de registrarse, hacemos login automático para mejor experiencia
      return await login(email, password);
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.error || 'Error al registrarse' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('client_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);