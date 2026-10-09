import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import Public from './Public.jsx';
import Admin from './Admin.jsx';

const isAdminPath = window.location.pathname.replace(/\/+$/, '').startsWith('/admin');
createRoot(document.getElementById('root')).render(isAdminPath ? <Admin /> : <Public />);
