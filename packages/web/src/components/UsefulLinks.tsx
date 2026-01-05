/**
 * UsefulLinks - Quick access to external NYC data sources
 */

const LINKS = [
  {
    label: 'DOB NOW',
    url: 'https://a810-dobnow.nyc.gov/publish/Index.html#!/',
    description: 'Search building permits, job filings, and applications',
  },
  {
    label: 'BISWeb',
    url: 'https://a810-bisweb.nyc.gov/bisweb/bsqpm01.jsp',
    description: 'Property info, complaints, violations, certificates',
  },
  {
    label: 'ZAP Search',
    url: 'https://zap.planning.nyc.gov/projects',
    description: 'Zoning applications and land use reviews (ULURP)',
  },
  {
    label: 'CEQR Access',
    url: 'https://a002-ceqraccess.nyc.gov/ceqr/',
    description: 'Environmental impact assessments for projects',
  },
];

export default function UsefulLinks() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-2">
      <h3 className="text-sm font-medium text-slate-900 mb-2">Useful Links</h3>
      <div className="space-y-0">
        {LINKS.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-0.5 hover:bg-slate-50 rounded transition-colors"
          >
            <span className="text-xs font-medium text-blue-600 hover:text-blue-800 w-20 flex-shrink-0">
              {link.label}
            </span>
            <span className="text-xs text-slate-400">{link.description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
