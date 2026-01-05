/**
 * UsefulLinks - Quick access to external NYC data sources
 */

const LINKS = [
  {
    label: 'DOB NOW',
    url: 'https://a810-dobnow.nyc.gov/publish/Index.html#!/',
    description: 'Building permits & filings',
  },
  {
    label: 'BISWeb',
    url: 'https://a810-bisweb.nyc.gov/bisweb/bsqpm01.jsp',
    description: 'Building Information System',
  },
  {
    label: 'ZAP Search',
    url: 'https://zap.planning.nyc.gov/projects',
    description: 'Zoning applications',
  },
];

export default function UsefulLinks() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-3 mb-2">
      <h3 className="text-xs font-medium text-slate-500 mb-2">Useful Links</h3>
      <div className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.description}
            className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
