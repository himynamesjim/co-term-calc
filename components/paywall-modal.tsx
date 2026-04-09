interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4">Premium Feature</h2>
        <p className="mb-4">{reason || 'This feature requires a premium subscription.'}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}
