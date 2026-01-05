/**
 * Places routes - Individual place details
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates, rawEvents } from '@ucm/pipeline';
import { eq } from 'drizzle-orm';
import type { PlaceDetail, SourceSummary, TransformationNature, Certainty, ProjectStatus } from '@ucm/shared';

// DOB NOW API response types
interface DobNowPw1Item {
  Bin?: string;
  JobDescription?: string;
  JobStatusLabel?: string;
  CurrentFilingStatusValue?: string;
  JobTypeLabel?: string;
  WorkonFloors?: string;
  Owner?: string;
  DesignProfessional?: string;
  Address?: string;
  Borough?: string;
  FilingNumber?: string;
}

interface DobNowApiResponse {
  IsSuccess?: boolean;
  pw1List?: DobNowPw1Item[];
}

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const querySchema = z.object({
  expand: z.string().optional(),
});

export const placesRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /places/:id - Get place details with transformation state
   */
  fastify.get('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const { expand } = querySchema.parse(request.query);

    // Fetch place with transformation state
    const place = await db.query.places.findFirst({
      where: eq(places.id, id),
      with: {
        transformationState: true,
      },
    });

    if (!place) {
      return reply.notFound('Place not found');
    }

    const state = place.transformationState;

    // Build response matching PlaceDetail type
    const response: PlaceDetail = {
      id: place.id,
      place: {
        address: place.address ?? undefined,
        neighborhood: place.ntaName ?? undefined,
        borough: place.borough ?? 'Unknown',
      },
      geometry: place.geometryJson as PlaceDetail['geometry'],
      transformation: state ? {
        intensity: state.intensity ?? 0,
        nature: (state.nature ?? 'mixed') as TransformationNature,
        certainty: (state.certainty ?? 'discussion') as Certainty,
        headline: state.headline ?? undefined,
        oneLiner: state.oneLiner ?? undefined,
        disruptionSummary: state.disruptionSummary ?? undefined,
        // Timeline dates
        disruptionStart: state.disruptionStart ?? undefined,
        disruptionEnd: state.disruptionEnd ?? undefined,
        visibleChangeDate: state.visibleChangeDate ?? undefined,
        usageChangeDate: state.usageChangeDate ?? undefined,
        // Data quality flags
        isEstimatedStart: state.isEstimatedStart === 1,
        isEstimatedEnd: state.isEstimatedEnd === 1,
        // Milestone dates
        approvalDate: state.approvalDate ?? undefined,
        permitExpiration: state.permitExpiration ?? undefined,
        // Project status
        projectStatus: (state.projectStatus ?? 'planning') as ProjectStatus,
        // Activity info
        eventCount: state.eventCount ?? 0,
        firstActivity: state.firstActivity ?? undefined,
        lastActivity: state.lastActivity ?? undefined,
      } : undefined,
    };

    // Include sources if requested
    if (expand === 'sources') {
      const events = await db.query.rawEvents.findMany({
        where: eq(rawEvents.placeId, id),
        orderBy: (e, { desc }) => [desc(e.eventDate)],
      });

      // Build sources with async DOB NOW enrichment
      response.sources = await Promise.all(
        events.map(async (event): Promise<SourceSummary> => {
          const rawData = event.rawData as Record<string, unknown> | null;
          const sourceId = getSourceId(event);

          // Fetch DOB NOW details for dob-now sources
          let dobNowDetails: SourceSummary['dobNowDetails'];
          if (event.source === 'dob-now' && sourceId) {
            dobNowDetails = await fetchDobNowDetails(sourceId);
          }

          return {
            sourceType: formatEventType(event.eventType, event.source),
            sourceId,
            description: formatEventDescription(event),
            agency: getAgency(rawData, event.source),
            projectType: getProjectType(rawData, event.source),
            filedDate: event.eventDate ?? undefined,
            dateLabel: getDateLabel(event.source),
            officialUrl: getOfficialUrl(event),
            dobNowDetails,
          };
        })
      );
    }

    return response;
  });
};

function formatEventType(type: string, source?: string): string {
  // Source-specific labels
  if (source === 'dob-complaints') return 'Complaint';
  if (source === 'dob-violations') return 'Violation';

  const labels: Record<string, string> = {
    new_building: 'New Building',
    major_alteration: 'Major Alteration',
    minor_alteration: 'Minor Alteration',
    demolition: 'Demolition',
    scaffold: 'Scaffold',
    equipment_work: 'Equipment',
    plumbing: 'Plumbing',
    mechanical: 'Mechanical',
    ulurp_filed: 'ULURP Filed',
    ulurp_approved: 'ULURP Approved',
    zap_filed: 'ZAP Filed',
    zap_approved: 'ZAP Approved',
    capital_project: 'Capital Project',
    construction_started: 'Construction Started',
    construction_completed: 'Construction Completed',
    other: 'Filing',
  };
  return labels[type] ?? type;
}

// DOB Complaint category codes - common ones
const COMPLAINT_CATEGORIES: Record<string, string> = {
  '01': 'Accident - Construction',
  '02': 'Adjacent Building',
  '03': 'Boiler',
  '04': 'Elevator',
  '05': 'Plumbing',
  '06': 'Building Shaking',
  '07': 'Crane',
  '08': 'Debris/Falling Material',
  '09': 'Electrical',
  '10': 'Excavation',
  '11': 'Facade',
  '12': 'Failure to Maintain',
  '13': 'Fence',
  '14': 'Gas',
  '15': 'Illegal Conversion',
  '16': 'Interior Demo',
  '17': 'Landmark Building',
  '18': 'Material Storage',
  '19': 'Mechanical',
  '20': 'Curb Cut',
  '21': 'Illegal Use',
  '23': 'Scaffold',
  '24': 'Sidewalk Shed',
  '25': 'Site Safety',
  '26': 'SRO',
  '27': 'Structural',
  '29': 'Demolition',
  '30': 'Sign/Awning',
  '31': 'Work Contrary',
  '45': 'Illegal Work',
  '49': 'Non-Compliance',
  '50': 'Structural Stability',
  '58': 'Support of Excavation',
  '59': 'Unsafe Conditions',
  '63': 'Permit Condition',
  '66': 'Illegal Apartments',
  '71': 'Unlicensed/Illegal Work',
  '74': 'Illegal SRO',
  '81': 'After Hours',
  '83': 'No Permit',
  '8A': 'Work Without Permit',
};

function formatEventDescription(event: typeof rawEvents.$inferSelect): string {
  const rawData = event.rawData as Record<string, unknown> | null;
  if (!rawData) return formatEventType(event.eventType, event.source);

  // Source-specific description extraction
  switch (event.source) {
    case 'capital':
      return (rawData['description'] as string) ?? formatEventType(event.eventType, event.source);
    case 'dob':
    case 'dob-now':
      return (rawData['job_description'] as string) ?? formatEventType(event.eventType, event.source);
    case 'dob-complaints': {
      const category = rawData['complaint_category'] as string | undefined;
      if (category) {
        return COMPLAINT_CATEGORIES[category] ?? `Category ${category}`;
      }
      return 'Unknown Complaint';
    }
    case 'dob-violations':
      return (rawData['violation_type'] as string) ?? formatEventType(event.eventType, event.source);
    case 'zap':
      return (rawData['project_name'] as string) ?? formatEventType(event.eventType, event.source);
    default:
      return formatEventType(event.eventType, event.source);
  }
}

function getSourceId(event: typeof rawEvents.$inferSelect): string | undefined {
  const rawData = event.rawData as Record<string, unknown> | null;
  if (!rawData) return event.sourceId ?? undefined;

  switch (event.source) {
    case 'capital':
      return (rawData['maprojid'] as string) ?? event.sourceId ?? undefined;
    case 'dob':
      return (rawData['job__'] as string) ?? event.sourceId ?? undefined;
    case 'dob-now':
      return (rawData['job_filing_number'] as string) ?? event.sourceId ?? undefined;
    case 'zap':
      return (rawData['project_id'] as string) ?? event.sourceId ?? undefined;
    default:
      return event.sourceId ?? undefined;
  }
}

function getAgency(rawData: Record<string, unknown> | null, source: string): string | undefined {
  if (!rawData) return undefined;

  switch (source) {
    case 'capital':
      return rawData['magencyname'] as string | undefined;
    default:
      return undefined;
  }
}

function getProjectType(rawData: Record<string, unknown> | null, source: string): string | undefined {
  if (!rawData) return undefined;

  switch (source) {
    case 'capital':
      return rawData['typecategory'] as string | undefined;
    case 'dob':
    case 'dob-now':
      return rawData['job_type'] as string | undefined;
    default:
      return undefined;
  }
}

function getOfficialUrl(event: typeof rawEvents.$inferSelect): string | undefined {
  const rawData = event.rawData as Record<string, unknown> | null;
  if (!rawData) return undefined;

  switch (event.source) {
    case 'capital': {
      // NYC Capital Projects Dashboard
      const projectId = rawData['maprojid'] as string | undefined;
      if (projectId) {
        return `https://capitalplanning.nyc.gov/table/capitalproject/${projectId}`;
      }
      break;
    }
    case 'dob': {
      const jobNumber = rawData['job__'] as string | undefined;
      if (jobNumber) {
        return `https://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjoession=P&passjoession2=P&pasession=P&passession2=P&requestid=&jobno=${jobNumber}`;
      }
      break;
    }
    case 'dob-now': {
      // DOB NOW doesn't support direct deep links - link to Job Number search page
      return 'https://a810-dobnow.nyc.gov/publish/Index.html#!/search';
    }
    case 'dob-complaints': {
      // BISWeb Complaints lookup - requires address, but link to search
      const bin = rawData['bin'] as string | undefined;
      if (bin) {
        return `https://a810-bisweb.nyc.gov/bisweb/ComplaintsByAddressServlet?allbin=${bin}`;
      }
      return 'https://a810-bisweb.nyc.gov/bisweb/bsqpm01.jsp';
    }
    case 'dob-violations': {
      const bin = rawData['bin'] as string | undefined;
      if (bin) {
        return `https://a810-bisweb.nyc.gov/bisweb/ActionViolationDisplayServlet?allbin=${bin}`;
      }
      return 'https://a810-bisweb.nyc.gov/bisweb/bsqpm01.jsp';
    }
    case 'zap': {
      const projectId = rawData['project_id'] as string | undefined;
      if (projectId) {
        return `https://zap.planning.nyc.gov/projects/${projectId}`;
      }
      break;
    }
  }
  return undefined;
}

function getDateLabel(source: string): string {
  const labels: Record<string, string> = {
    capital: 'Projected',
    dob: 'Filed',
    'dob-now': 'Filed',
    'dob-complaints': 'Reported',
    'dob-violations': 'Issued',
    zap: 'Filed',
    ceqr: 'Filed',
  };
  return labels[source] ?? 'Date';
}

/**
 * Fetch enriched details from DOB NOW public API
 * API: https://a810-dobnow.nyc.gov/Publish/WrapperPP/PublicPortal.svc/GlobalSearchApplication/{JobNumber}
 *
 * The job filing number format is "B00703063-I1" where:
 * - B00703063 is the job number (used for API lookup)
 * - I1 is the filing number (used to find the right entry in pw1List)
 */
async function fetchDobNowDetails(jobFilingNumber: string): Promise<SourceSummary['dobNowDetails'] | undefined> {
  try {
    // Parse job number and filing number from format "B00703063-I1"
    const parts = jobFilingNumber.split('-');
    const jobNumber = parts[0];
    const filingNumber = parts[1]; // e.g., "I1"

    if (!jobNumber) return undefined;

    const response = await fetch(
      `https://a810-dobnow.nyc.gov/Publish/WrapperPP/PublicPortal.svc/GlobalSearchApplication/${encodeURIComponent(jobNumber)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json() as DobNowApiResponse;

    if (!data.IsSuccess || !data.pw1List || data.pw1List.length === 0) {
      return undefined;
    }

    // Find the matching filing in the list, or use the first one
    const filing = filingNumber
      ? data.pw1List.find(f => f.FilingNumber === filingNumber) ?? data.pw1List[0]
      : data.pw1List[0];

    if (!filing) return undefined;

    return {
      bin: filing.Bin || undefined,
      address: filing.Address || undefined,
      borough: filing.Borough || undefined,
      owner: filing.Owner || undefined,
      designProfessional: filing.DesignProfessional || undefined,
      jobStatus: filing.JobStatusLabel || undefined,
      filingStatus: filing.CurrentFilingStatusValue || undefined,
      jobType: filing.JobTypeLabel || undefined,
      floors: filing.WorkonFloors || undefined,
    };
  } catch {
    // Silently fail - API enrichment is optional
    return undefined;
  }
}
