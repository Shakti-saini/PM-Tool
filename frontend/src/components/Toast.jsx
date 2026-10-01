import { Check } from 'lucide-react';

export default function Toast({ message }) {
  if (!message) return null;
  return <div className="toast"><span className="toast-check"><Check size={14} /></span>{message}</div>;
}
