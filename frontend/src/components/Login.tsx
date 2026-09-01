import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Waves, Shield, CheckCircle2 } from 'lucide-react';
import './Login.css';
import LoginBackground from './LoginBackground';



export default function Login({ onLogin }: { onLogin?: () => void }) {
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    
    // Front-end demonstration delay
    setTimeout(() => {
      if (onLogin) onLogin();
    }, 1500);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.1
      }
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' }
    }
  };

  return (
    <div className="signin-shell">
      {/* Background animated elements */}
      <LoginBackground />
      <div className={`signin-grid ${submitted ? 'collapsing' : ''}`} />
      <div className="signin-scanline" />
      <div className="signin-orbit signin-orbit-one" />
      <div className="signin-orbit signin-orbit-two" />
      <div className="signin-particles">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} className={`signin-particle signin-particle-${index + 1}`} />
        ))}
      </div>
      <div className="signin-wave signin-wave-one" />
      <div className="signin-wave signin-wave-two" />

      {/* Main Login Card */}
      <motion.div 
        className="signin-card"
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
        variants={cardVariants}
      >
        <motion.div variants={fieldVariants} className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl border border-cyan-500/40 bg-cyan-950/50 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <Waves size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-cyan-50 font-sans mb-3 text-center">
            AQUA<span className="text-cyan-400">GNN</span> GATEWAY
          </h1>
          <div className="px-3 py-1.5 border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[9px] font-mono font-bold tracking-widest rounded flex items-center gap-2 uppercase">
            <Shield size={12} className="text-amber-500" />
            <span>RESTRICTED ACCESS</span>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <motion.div variants={fieldVariants} className="signin-field-wrapper">
            <label htmlFor="department-id" className="signin-label">
              Department ID / Official Email
            </label>
            <div className="relative">
              <input
                id="department-id"
                name="departmentId"
                autoComplete="username"
                required
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                className="signin-field"
                disabled={submitted}
              />
            </div>
          </motion.div>

          <motion.div variants={fieldVariants} className="signin-field-wrapper">
            <label htmlFor="secure-password" className="signin-label">
              Secure Password
            </label>
            <div className="relative">
              <input
                id="secure-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="signin-field"
                disabled={submitted}
              />
            </div>
          </motion.div>

          <motion.div variants={fieldVariants} className="mt-4">
            <button 
              type="submit" 
              className="signin-submit flex items-center justify-center gap-2"
              disabled={submitted}
            >
              {submitted ? (
                <>
                  <CheckCircle2 size={16} />
                  AUTHENTICATED
                </>
              ) : (
                'Authenticate Operator'
              )}
            </button>
          </motion.div>
        </form>

        <motion.div 
          variants={fieldVariants}
          className="mt-8 pt-4 border-t border-slate-800/80 flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-widest"
        >
          <span>SYS_STATUS: ONLINE | API_CONNECTED</span>
          <span className="flex items-center gap-1.5 text-emerald-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            SECURE
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
