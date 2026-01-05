/**
 * Places routes - Individual place details
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, places, transformationStates, rawEvents } from '@ucm/pipeline';
import { eq } from 'drizzle-orm';
import type { PlaceDetail, SourceSummary, TransformationNature, Certainty, ProjectStatus, PropertyDetails } from '@ucm/shared';

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

// DOB NOW Property Details API response
interface PropertyDetailsApiResponse {
  IsSuccess?: boolean;
  PropertyDetails?: {
    BIN?: string;
    Borough?: number;
    TaxBlock?: number;
    TaxLot?: number;
    HouseNo?: string;
    StreetName?: string;
    Zip?: string;
    CrossStreet1?: string;
    CrossStreet2?: string;
    CrossStreet3?: string;
    VlFinaOccpncy?: string;
    BuildingsonLot?: number;
    Vacant?: string;
    CityOwned?: string;
    Condo?: string;
    SpecialArea?: string;
    SpecialDistrict?: string;
    LandmarkStatus?: string;
    SpecialFloodHazardArea?: string;
    CoastalErosionHazardArea?: string;
    FreshwaterWetlands?: string;
    TidalWetlands?: string;
    SRORestricted?: string;
    LoftLaw?: string;
    AntiHarassmentRequirements?: boolean;
    CommunityBoard?: number;
    CensusTract?: number;
  };
  PropertyViolation?: {
    Class1Violation?: string;
    StopWork?: string;
    PadlockFlag?: string;
    VacateFlag?: string;
    FilingOnHold?: string;
    ApprovalOnHold?: string;
  };
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

          // Build complaint details for dob-complaints sources
          let complaintDetails: SourceSummary['complaintDetails'];
          if (event.source === 'dob-complaints' && rawData) {
            const categoryCode = (rawData['complaint_category'] as string) ?? '';
            const dispositionCode = (rawData['disposition_code'] as string) ?? '';
            complaintDetails = {
              status: (rawData['status'] as string) ?? 'UNKNOWN',
              category: COMPLAINT_CATEGORIES[categoryCode] ?? `Category ${categoryCode}`,
              categoryCode,
              disposition: DISPOSITION_CODES[dispositionCode] ?? dispositionCode,
              dispositionCode: dispositionCode || undefined,
              inspectionDate: rawData['inspection_date'] as string | undefined,
              dispositionDate: rawData['disposition_date'] as string | undefined,
            };
          }

          // Build ZAP details for zap sources
          let zapDetails: SourceSummary['zapDetails'];
          if (event.source === 'zap' && rawData) {
            const actionsStr = rawData['actions'] as string | undefined;
            const ulurpNumbersStr = rawData['ulurp_numbers'] as string | undefined;
            zapDetails = {
              projectName: (rawData['project_name'] as string) ?? 'ZAP Project',
              projectBrief: rawData['project_brief'] as string | undefined,
              publicStatus: (rawData['public_status'] as string) ?? 'Unknown',
              isUlurp: rawData['ulurp_non'] === 'ULURP',
              actions: actionsStr?.split(';').map(s => s.trim()).filter(Boolean),
              ulurpNumbers: ulurpNumbersStr?.split(';').map(s => s.trim()).filter(Boolean),
              ceqrNumber: rawData['ceqr_number'] as string | undefined,
              currentMilestone: rawData['current_milestone'] as string | undefined,
              currentMilestoneDate: rawData['current_milestone_date'] as string | undefined,
              certifiedDate: rawData['certified_referred'] as string | undefined,
              applicant: rawData['primary_applicant'] as string | undefined,
              applicantType: rawData['applicant_type'] as string | undefined,
              communityDistrict: rawData['community_district'] as string | undefined,
            };
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
            complaintDetails,
            zapDetails,
          };
        })
      );

      // Extract BIN from sources (either from rawData or dobNowDetails)
      let bin: string | undefined;
      for (const event of events) {
        const rawData = event.rawData as Record<string, unknown> | null;
        if (rawData?.['bin']) {
          bin = rawData['bin'] as string;
          break;
        }
      }
      // Fallback: get BIN from DOB NOW enrichment
      if (!bin) {
        const sourceWithBin = response.sources?.find(s => s.dobNowDetails?.bin);
        bin = sourceWithBin?.dobNowDetails?.bin;
      }

      // Fetch property details if we have a BIN
      if (bin) {
        response.propertyDetails = await fetchPropertyDetails(bin);
      }
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

// DOB Complaint category codes - comprehensive list
const COMPLAINT_CATEGORIES: Record<string, string> = {
  // 01-09: Safety/Accidents
  '01': 'Accident - Construction',
  '02': 'Adjacent Building',
  '03': 'Boiler',
  '04': 'Elevator',
  '05': 'Plumbing',
  '06': 'Building Shaking',
  '07': 'Crane',
  '08': 'Debris/Falling Material',
  '09': 'Electrical',
  // 10-19: Building Issues
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
  // 1A-1Z: Special Categories
  '1A': 'Illegal Conversion - Commercial to Dwelling',
  '1B': 'Illegal Conversion - Industrial',
  '1C': 'Illegal Conversion - Residential',
  '1D': 'Illegal Conversion - Manufacturing',
  '1E': 'Elevator - Defective/Dangerous',
  '1F': 'Elevator - No Certificate',
  '1G': 'Failure to Maintain - SRO',
  '1H': 'Failure to Maintain - HPD',
  '1J': 'Illegal Work - No Permit',
  '1K': 'Illegal Work - Contrary to Plans',
  '1L': 'Illegal Work - Unsafe',
  '1M': 'Fire Safety - Sprinkler',
  '1N': 'Fire Safety - Standpipe',
  '1P': 'Fire Safety - Alarm',
  '1Q': 'Fire Safety - Exit',
  '1R': 'Structural - General',
  '1S': 'Structural - Foundation',
  '1T': 'Structural - Wall',
  '1U': 'Structural - Roof',
  '1V': 'Structural - Floor',
  '1W': 'Structural - Stairway',
  '1X': 'Unsafe Conditions - General',
  '1Y': 'Unsafe Conditions - Occupancy',
  '1Z': 'Unsafe Conditions - Fire',
  // 20-29: Permits/Work
  '20': 'Curb Cut',
  '21': 'Illegal Use',
  '22': 'Retaining Wall',
  '23': 'Scaffold',
  '24': 'Sidewalk Shed',
  '25': 'Site Safety',
  '26': 'SRO',
  '27': 'Structural',
  '28': 'Support of Excavation',
  '29': 'Demolition',
  // 2A-2Z: Special Categories
  '2A': 'Structural - Cracked/Settling',
  '2B': 'Structural - Bulging/Leaning',
  '2C': 'Structural - Damaged by Fire',
  '2D': 'Structural - Water Damage',
  '2E': 'Structural - Partial Collapse',
  '2F': 'Structural - Unstable',
  '2G': 'Structural - Adjacent Building',
  '2H': 'Structural - Excavation Related',
  '2J': 'Foundation - Settlement',
  '2K': 'Foundation - Cracked',
  '2L': 'Foundation - Undermined',
  '2M': 'Wall - Cracked/Damaged',
  '2N': 'Wall - Bulging/Leaning',
  '2P': 'Wall - Party Wall Issue',
  '2Q': 'Roof - Damaged/Leaking',
  '2R': 'Roof - Structural Failure',
  '2S': 'Floor - Damaged/Unsafe',
  '2T': 'Floor - Structural Failure',
  '2U': 'Stairway - Damaged/Unsafe',
  '2V': 'Stairway - Missing/Blocked',
  '2W': 'Support Beam - Damaged',
  '2X': 'Column - Damaged',
  '2Y': 'General Structural Concern',
  '2Z': 'Other Structural Issue',
  // 30-39: Signs/Work
  '30': 'Sign/Awning',
  '31': 'Work Contrary to Plans',
  '32': 'Plumbing - Cross Connection',
  '33': 'Vacant Building',
  '34': 'Work Stop Order Violation',
  '35': 'Zoning',
  '36': 'Sprinkler',
  '37': 'Standpipe',
  '38': 'Fire Escape',
  '39': 'Fire Safety',
  // 3A-3H: Special
  '3A': 'Illegal Apartments',
  '3B': 'Illegal Commercial Use',
  '3C': 'Illegal Manufacturing Use',
  '3D': 'Non-Permitted Work',
  '3E': 'Inadequate Egress',
  '3G': 'Construction - Site Safety',
  '3H': 'Construction - Noise',
  // 40-49: Work/Permits
  '40': 'DOB Action Required',
  '41': 'Building Collapse',
  '42': 'Partial Collapse',
  '43': 'Imminent Collapse',
  '44': 'Illegal Parking Lot',
  '45': 'Illegal Work',
  '46': 'Work Without Permit',
  '47': 'Unlicensed Contractor',
  '48': 'Debris - Falling/Thrown',
  '49': 'Non-Compliance',
  // 4A-4Z: Special
  '4A': 'Elevator - No Permit',
  '4B': 'Boiler - No Permit',
  '4C': 'Crane - No Permit',
  '4D': 'Scaffold - Unsafe',
  '4F': 'Fence - Unsafe',
  '4G': 'Gas - Illegal Work',
  '4H': 'HVAC - Illegal Work',
  // 50-59: Structural/Safety
  '50': 'Structural Stability',
  '51': 'Foundation',
  '52': 'Wall Cracked/Bulging',
  '53': 'Ceiling/Roof Defect',
  '54': 'Floor Defect',
  '55': 'Stairway Defect',
  '56': 'Fire Damage',
  '57': 'Water Damage',
  '58': 'Support of Excavation',
  '59': 'Unsafe Conditions',
  // 5A-5H: Special
  '5A': 'Unsafe - General',
  '5B': 'Unsafe - Structural',
  '5C': 'Unsafe - Fire Safety',
  '5D': 'Unsafe - Egress',
  '5E': 'Unsafe - Mechanical',
  '5F': 'Unsafe - Electrical',
  '5G': 'Unsafe - Plumbing',
  '5H': 'Unsafe - Elevator',
  // 60-69: Permits/Zoning
  '60': 'Certificate of Occupancy',
  '61': 'Temporary C of O',
  '62': 'Change of Use',
  '63': 'Permit Condition',
  '64': 'Variance Violation',
  '65': 'Special Permit Violation',
  '66': 'Illegal Apartments',
  '67': 'Illegal Cellar/Basement',
  '68': 'Illegal Rooftop',
  '69': 'Illegal Attic',
  // 6A-6Z: Special
  '6A': 'Zoning - Residential',
  '6B': 'Zoning - Commercial',
  '6C': 'Zoning - Manufacturing',
  '6D': 'Zoning - Height/Bulk',
  '6M': 'Mechanical Code Violation',
  '6S': 'Sprinkler Code Violation',
  '6V': 'Ventilation Code Violation',
  '6W': 'Fire Alarm Violation',
  '6X': 'Emergency Lighting',
  '6Y': 'Exit Signs',
  '6Z': 'Fire Extinguisher',
  // 70-79: SRO/Enforcement
  '70': 'SRO - General',
  '71': 'SRO - Illegal Work',
  '72': 'SRO - Change of Use',
  '73': 'SRO - Failure to Maintain',
  '74': 'SRO - Illegal Conversion',
  '75': 'Adult Establishment',
  '76': 'Unlicensed Plumbing Work',
  '77': 'Handicap Access (LL58/87)',
  '78': 'Public Space Non-Compliance',
  '79': 'Lights - Parking Lot',
  // 7A-7Z: CSE/Enforcement
  '7A': 'Integrity Complaint',
  '7B': 'Illegal Use - C1/C2 Zone',
  '7F': 'CSE: Tracking Compliance',
  '7G': 'CSE: Sweep',
  '7J': 'Work Without Permit - Occupied',
  '7K': 'LL188/17 Compliance',
  '7L': 'DOHMH Referral',
  '7N': 'Quality of Life',
  '7P': 'Proactive Enforcement',
  '7Q': 'Safety Compliance',
  '7R': 'Re-inspection',
  '7S': 'Special Enforcement',
  // 80-89: Elevator/Equipment
  '80': 'Elevator - No Inspection',
  '81': 'After Hours Work',
  '82': 'Excessive Noise',
  '83': 'No Permit',
  '84': 'Permit Expired',
  '85': 'Permit Revoked',
  '86': 'Stop Work Order',
  '87': 'Vacate Order',
  '88': 'Unsafe Equipment',
  '89': 'Equipment Failure',
  // 8A-8P: Special
  '8A': 'Work Without Permit',
  '8P': 'Plumbing - No Permit',
  // 90-99: Site Safety
  '90': 'Site Safety - General',
  '91': 'Site Safety - Worker Endangerment',
  '92': 'Illegal Conversion - Industrial',
  '93': 'Retaining Wall Inspection',
  '94': 'Plumbing - Defective',
  '95': 'Construction Fence',
  '96': 'Sidewalk Bridge',
  '97': 'Protective Measures',
  '98': 'Dust/Debris Control',
  '99': 'General Complaint',
};

// DOB Complaint disposition codes - full list from NYC Open Data
const DISPOSITION_CODES: Record<string, string> = {
  'A1': 'Violation(s) Served',
  'A2': 'Criminal Court Summons Served',
  'A3': 'Full Stop Work Order',
  'A4': 'Violation & Criminal Summons',
  'A5': 'Violation & Criminal Summons',
  'A6': 'Vacant/Unguarded - Violation Issued',
  'A7': 'Accepted by Padlock Unit',
  'A8': 'ECB Violation Served',
  'A9': 'ECB & DOB Violations Served',
  'AF': 'Action Filed',
  'B1': 'Violation Prepared - To Be Served',
  'B2': 'ECB Violation Prepared - To Be Served',
  'C1': 'No Access - 1st Attempt',
  'C2': 'No Access - 2nd Attempt',
  'C3': 'Access Denied - 1st Attempt',
  'C4': 'Access Denied - 2nd Attempt',
  'C5': 'After Work: No Access - 1st',
  'C6': 'After Work: Access Denied - 1st',
  'C7': 'After Work: No Access - 2nd',
  'C8': 'After Work: Access Denied - 2nd',
  'D1': 'Assigned to Construction',
  'D2': 'Assigned to Plumbing',
  'D3': 'Assigned to Elevator',
  'D4': 'Assigned to BEST Squad',
  'D5': 'Assigned to Emergency Response',
  'D6': 'Assigned to Boiler',
  'D7': 'Assigned to Cranes & Derricks',
  'D8': 'Assigned to Executive Inspections',
  'D9': 'Assigned to Electrical',
  'E1': 'Assigned to Building Marshal',
  'E2': 'Assigned to Padlock Unit',
  'E3': 'Assigned to Boro Office',
  'E4': 'Assigned to Handicap Access',
  'E5': 'Assigned for Re-evaluation',
  'E6': 'Assigned to Special Operations',
  'E7': 'Assigned to Scaffold Safety',
  'E8': 'Assigned to Excavation Audits',
  'E9': 'Assigned to Stalled Sites',
  'EA': 'Assigned to Interior Demo',
  'EB': 'Assigned to Facade Program',
  'EC': 'Assigned to Compromised Buildings',
  'ED': 'Assigned to Retaining Walls',
  'EE': 'Reassigned for Review',
  'EZ': 'Assigned to DOI',
  'F1': 'Referred to DEP',
  'F2': 'Referred to DHCR',
  'F3': 'Referred to Health Dept',
  'F4': 'Referred for Review',
  'F5': 'Referred to Sanitation',
  'F6': 'Referred to DOT',
  'F7': 'Referred to Real Property',
  'F8': 'Referred to HPD',
  'F9': 'Referred to HUD',
  'G1': 'Referred to Inspector General',
  'G2': 'Referred to Parks',
  'G3': 'Referred to TLC',
  'G4': 'Referred to Consumer Affairs',
  'G5': 'Referred to NYPD',
  'G6': 'Referred to FDNY',
  'G7': 'Referred to Special Enforcement',
  'G8': 'Referred to NYCHA',
  'G9': 'Referred to DCAS',
  'H1': 'See Other Complaint',
  'H2': 'Previously Inspected',
  'H3': 'Violation for Disobeying SWO',
  'H4': 'Summons for Disobeying SWO',
  'H5': 'Stop All Work - No TCAO',
  'I1': 'Unsubstantiated by Records',
  'I2': 'No Violation Warranted',
  'I3': 'Compliance Inspection Done',
  'J1': 'Follow-up Pending Research',
  'J2': 'Resolved by Periodic Inspection',
  'J3': 'Reviewed - Inspection Scheduled',
  'J4': 'Follow-up for Hazard Scheduled',
  'K1': 'Unable to Locate Address',
  'K2': 'Address Invalid',
  'K3': 'Cranes - No Address',
  'K4': 'Cranes - SWO No Address',
  'K5': 'Letter of Deficiency Issued',
  'K6': 'Deficiency + Partial SWO',
  'K7': 'Correction Notification Received',
  'K8': 'Correction Verified',
  'L1': 'Partial Stop Work Order',
  'L2': 'Stop Work Fully Rescinded',
  'L3': 'Stop Work Partially Rescinded',
  'M1': 'Bike Access: Elevator OK',
  'M3': 'Bike Access: Parking Met',
  'M4': 'Bike Access: Parking Not Met',
  'MA': 'MARCH: No Enforcement',
  'MB': 'MARCH: Failure to Maintain',
  'MC': 'MARCH: Contrary to Plans',
  'MD': 'MARCH: Exit Obstructed',
  'ME': 'MARCH: Exit Obstructed + Vacate',
  'MF': 'MARCH: Exit + Partial Vacate',
  'MG': 'MARCH: Occupancy Violation',
  'MH': 'MARCH: No PA Permit + Vacate',
  'MI': 'MARCH: No PA + Partial Vacate',
  'MJ': 'MARCH: Work Without Permit',
  'MK': 'MARCH: No PA Permit',
  'ND': 'Notice of Deficiency',
  'P1': 'Job Vested',
  'P2': 'Follow-up Pending Adoption',
  'P3': 'Padlock Order Issued',
  'P4': 'Padlock Order Rescinded',
  'P5': 'Potential Plumbing Work',
  'P6': 'Initial Notification Accepted',
  'Q1': 'Compromised: Report Required',
  'Q4': 'Compromised: Remedied',
  'R1': 'No Action/No Follow-up',
  'R3': 'No Action/Monthly Inspection',
  'R4': 'Engineering Assessment Required',
  'R5': 'Class 1 ECB/Order to Correct',
  'R6': 'Engineering: No Action',
  'R7': 'Engineering: Weekly Assessment',
  'R8': 'Engineering: Monthly Assessment',
  'R9': 'Building At Risk - No Danger',
  'RA': 'Commissioner Order Issued',
  'RB': 'Commissioner: Plans Accepted',
  'RE': 'Commissioner: Weekly Monitoring',
  'RG': 'Commissioner: Remediation Done',
  'RH': 'Emergency Declaration Issued',
  'RI': 'Immediate Emergency Declared',
  'RJ': 'Emergency Action Completed',
  'RK': 'Unsafe Building - Violation',
  'RL': 'Unsafe Building - Completed',
  'RM': 'Structural: Report Required',
  'RN': 'Structural: Deadline Passed',
  'RT': 'Compromised: Action Completed',
  'RU': 'LL11 Unsafe - Initiated',
  'RV': 'LL11 Unsafe - Completed',
  'RW': 'Emergency Previously Issued',
  'RX': 'Unsafe Precept Underway',
  'RY': 'Facade Report Underway',
  'RZ': 'Vacate Previously Issued',
  'S0': 'Stalled: All Work Completed',
  'S1': 'Stalled: Excavation Safe',
  'S2': 'Stalled: Excavation Deteriorating',
  'S3': 'Stalled: Excavation Unsafe',
  'S4': 'Stalled: Superstructure Safe',
  'S5': 'Stalled: Superstructure Deteriorating',
  'S6': 'Stalled: Superstructure Unsafe',
  'S7': 'Stalled: Graded & Fenced',
  'S8': 'Stalled: Construction In Progress',
  'S9': 'Stalled: Emergency Filed',
  'V3': 'SWO for After Hours Work',
  'W1': 'Violation for Disobeying Vacate',
  'WA': 'Weather: No Action',
  'WB': 'Weather: No Access',
  'WD': 'Weather: Yellow Tag/Eng Required',
  'WE': 'Weather: Downgraded to Yellow',
  'WF': 'Weather: Downgraded to Green',
  'WG': 'Weather: Green Rescinded',
  'WH': 'Weather: Green/Utilities Issue',
  'WI': 'Weather: Refer to Other Agency',
  'WJ': 'Weather: See Other Complaint',
  'XX': 'Administrative Closure',
  'Y1': 'Full Vacate Order',
  'Y2': 'Vacate Fully Rescinded',
  'Y3': 'Partial Vacate Order',
  'Y4': 'Vacate Partially Rescinded',
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
    case 'ceqr': {
      // CEQR Access doesn't support deep links, link to search page
      // User can search by CEQR number (shown in the detail panel)
      return 'https://a002-ceqraccess.nyc.gov/ceqr/';
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

/**
 * Fetch property details from DOB NOW Property Details API
 * API: https://a810-dobnow.nyc.gov/Publish/WrapperPP/PublicPortal.svc/getPublicPortalPropertyDetailsGet/{type}|{bin}
 *
 * The first parameter is a "type" code (use 2), not the borough.
 * The borough is returned in the response based on the BIN.
 */
async function fetchPropertyDetails(bin: string): Promise<PropertyDetails | undefined> {
  try {
    // Use type=2 for the API call (not borough code)
    const response = await fetch(
      `https://a810-dobnow.nyc.gov/Publish/WrapperPP/PublicPortal.svc/getPublicPortalPropertyDetailsGet/2%7C${bin}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return undefined;
    }

    const data = await response.json() as PropertyDetailsApiResponse;

    if (!data.IsSuccess || !data.PropertyDetails) {
      return undefined;
    }

    const prop = data.PropertyDetails;
    const viol = data.PropertyViolation;

    // Build BBL from borough + block + lot (use borough from response, not from BIN)
    const borough = prop.Borough ?? 0;
    const taxBlock = prop.TaxBlock ?? 0;
    const taxLot = prop.TaxLot ?? 0;
    const bbl = `${borough}${String(taxBlock).padStart(5, '0')}${String(taxLot).padStart(4, '0')}`;

    // Collect cross streets
    const crossStreets: string[] = [];
    if (prop.CrossStreet1) crossStreets.push(prop.CrossStreet1);
    if (prop.CrossStreet2) crossStreets.push(prop.CrossStreet2);
    if (prop.CrossStreet3) crossStreets.push(prop.CrossStreet3);

    return {
      bin: prop.BIN ?? bin,
      bbl,
      borough: prop.Borough ?? borough,
      taxBlock,
      taxLot,
      houseNumber: prop.HouseNo || undefined,
      streetName: prop.StreetName || undefined,
      zip: prop.Zip || undefined,
      crossStreets: crossStreets.length > 0 ? crossStreets : undefined,
      occupancy: prop.VlFinaOccpncy || undefined,
      buildingsOnLot: prop.BuildingsonLot || undefined,
      vacant: prop.Vacant === 'YES',
      cityOwned: prop.CityOwned === 'YES',
      condo: prop.Condo === 'YES',
      specialArea: prop.SpecialArea || undefined,
      specialDistrict: prop.SpecialDistrict || undefined,
      landmarkStatus: prop.LandmarkStatus || undefined,
      floodZone: prop.SpecialFloodHazardArea === 'Y',
      coastalErosion: prop.CoastalErosionHazardArea === 'Y',
      freshwaterWetlands: prop.FreshwaterWetlands === 'Y',
      tidalWetlands: prop.TidalWetlands === 'Y',
      sroRestricted: prop.SRORestricted === 'YES',
      loftLaw: prop.LoftLaw?.trim() === 'YES',
      antiHarassment: prop.AntiHarassmentRequirements === true,
      hasClass1Violation: viol?.Class1Violation !== 'N' && viol?.Class1Violation !== '',
      hasStopWork: viol?.StopWork !== 'N' && viol?.StopWork !== '',
      hasPadlock: viol?.PadlockFlag !== 'N' && viol?.PadlockFlag !== '',
      hasVacateOrder: viol?.VacateFlag !== 'N' && viol?.VacateFlag !== '',
      filingOnHold: viol?.FilingOnHold === 'Y',
      approvalOnHold: viol?.ApprovalOnHold === 'Y',
      communityBoard: prop.CommunityBoard ? String(prop.CommunityBoard) : undefined,
      censusTract: prop.CensusTract || undefined,
    };
  } catch {
    // Silently fail - API enrichment is optional
    return undefined;
  }
}
