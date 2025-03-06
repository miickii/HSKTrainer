export function WordCard({ word, example, onClick, children }) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-3">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-1">{word.simplified}</h2>
          {/* Other common elements */}
          {children} {/* For custom content */}
        </div>
      </div>
    );
}