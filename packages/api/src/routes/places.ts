/**
 * Places routes - Individual place details
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates, rawEvents } from '@ucm/pipeline';
import { eq } from 'drizzle-orm';
import type { PlaceDetail, SourceSummary, TransformationNature, Certainty, ProjectStatus } from '@ucm/shared';

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

      response.sources = events.map((event): SourceSummary => {
        const rawData = event.rawData as Record<string, unknown> | null;
        return {
          sourceType: formatEventType(event.eventType),
          sourceId: getSourceId(event),
          description: formatEventDescription(event),
          agency: getAgency(rawData, event.source),
          projectType: getProjectType(rawData, event.source),
          filedDate: event.eventDate ?? undefined,
          dateLabel: getDateLabel(event.source),
          officialUrl: getOfficialUrl(event),
        };
      });
    }

    return response;
  });
};

function formatEventType(type: string): string {
  const labels: Record<string, string> = {
    new_building: 'Nouvel immeuble',
    major_alteration: 'Rénovation majeure',
    minor_alteration: 'Rénovation mineure',
    demolition: 'Démolition',
    scaffold: 'Échafaudage',
    equipment_work: 'Travaux d\'équipement',
    plumbing: 'Plomberie',
    mechanical: 'Mécanique',
    ulurp_filed: 'Dossier déposé',
    ulurp_approved: 'Dossier approuvé',
    zap_filed: 'Demande déposée',
    zap_approved: 'Demande approuvée',
    capital_project: 'Projet public',
    construction_started: 'Début des travaux',
    construction_completed: 'Fin des travaux',
  };
  return labels[type] ?? type;
}

function formatEventDescription(event: typeof rawEvents.$inferSelect): string {
  const rawData = event.rawData as Record<string, unknown> | null;
  if (!rawData) return formatEventType(event.eventType);

  // Source-specific description extraction
  switch (event.source) {
    case 'capital':
      return (rawData['description'] as string) ?? formatEventType(event.eventType);
    case 'dob':
    case 'dob-now':
      return (rawData['job_description'] as string) ?? formatEventType(event.eventType);
    case 'dob-complaints':
      return (rawData['complaint_category'] as string) ?? formatEventType(event.eventType);
    case 'dob-violations':
      return (rawData['violation_type'] as string) ?? formatEventType(event.eventType);
    case 'zap':
      return (rawData['project_name'] as string) ?? formatEventType(event.eventType);
    default:
      return formatEventType(event.eventType);
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
      // User can copy the job filing number from the UI and search
      return 'https://a810-dobnow.nyc.gov/publish/Index.html#!/search';
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
