export default function Avatar({ name, className = '' }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <span className={`avatar ${className}`}>{initials}</span>;
}
