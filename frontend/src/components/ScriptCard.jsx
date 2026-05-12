export default function ScriptCard({ id, title, description, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`rounded-xl border p-5 text-left transition-all ${
        selected
          ? 'border-[1.5px] border-pb-dark bg-pb-cream'
          : 'border border-pb-dark/[0.12] bg-white hover:border-pb-dark/[0.25]'
      }`}
    >
      <h3 className="mb-1 text-[13.5px] font-medium text-pb-dark">{title}</h3>
      <p className="text-[12px] text-pb-muted">{description}</p>
      {selected && (
        <div className="mt-3 inline-block rounded-full bg-pb-warm px-2.5 py-0.5 text-[11px] font-medium text-pb-dark">
          Selected
        </div>
      )}
    </button>
  );
}
