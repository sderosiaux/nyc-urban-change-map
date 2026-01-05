/**
 * DetailPanel - Shows detailed information about a selected place
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useViewStore } from '../stores/viewStore';
import { usePlaceDetail } from '../hooks/useMapData';
import Tooltip from './Tooltip';
import ExternalLinkBadge from './ExternalLinkBadge';

const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 480; // Wider default for better readability

// DOB Complaint disposition explanations for tooltips
const DISPOSITION_EXPLANATIONS: Record<string, string> = {
  'No Violation Warranted': 'Inspector found no code violation at the time of inspection',
  'Violation(s) Served': 'Inspector found violations and issued official notice to correct',
  'ECB Violation Served': 'Environmental Control Board violation issued - may include fines',
  'ECB & DOB Violations Served': 'Both ECB and DOB violations were issued',
  'No Access - 1st Attempt': 'Inspector could not access the property (1st try)',
  'No Access - 2nd Attempt': 'Inspector could not access the property (2nd try) - complaint may be closed',
  'Access Denied - 1st Attempt': 'Property owner refused inspector access (1st try)',
  'Access Denied - 2nd Attempt': 'Property owner refused inspector access (2nd try)',
  'Full Stop Work Order': 'All construction work must cease immediately',
  'Partial Stop Work Order': 'Some construction work must cease',
  'Criminal Court Summons Served': 'Serious violation requiring court appearance',
  'Referred to HPD': 'Complaint forwarded to Housing Preservation & Development',
  'Referred to FDNY': 'Complaint forwarded to Fire Department',
  'Referred to DEP': 'Complaint forwarded to Environmental Protection',
  'Administrative Closure': 'Complaint closed without inspection (duplicate, invalid, etc.)',
  'Action Filed': 'Legal or enforcement action has been initiated',
  'Full Vacate Order': 'Building must be evacuated immediately',
  'Partial Vacate Order': 'Part of building must be evacuated',
};

// DOB Job type labels (human-readable) and explanations
const JOB_TYPE_LABELS: Record<string, string> = {
  // New construction
  'New Building': 'New building from ground up',
  'NB': 'New building from ground up',
  // Alterations
  'Alteration': 'Building modification',
  'Alteration CO': 'Major renovation (new certificate)',
  'ALT-CO': 'Major renovation (new certificate)',
  'ALT-CO - New Building with Existing Elements to Remain': 'Rebuild keeping some elements',
  'Alteration Type 1': 'Major work (exits/layout change)',
  'Alteration Type 2': 'Multiple work types',
  'Alteration Type 3': 'Single minor work type',
  'A1': 'Major work (exits/layout change)',
  'A2': 'Multiple work types',
  'A3': 'Single minor work type',
  // Demolition
  'Demolition': 'Building demolition',
  'DM': 'Building demolition',
  'Full Demolition': 'Complete demolition',
  'Partial Demolition': 'Partial demolition',
  // Work types
  'Scaffold': 'Scaffolding installation',
  'Equipment': 'Equipment installation',
  'Equipment Work': 'Equipment installation',
  'Plumbing': 'Plumbing work',
  'PL': 'Plumbing work',
  'Mechanical': 'HVAC / elevator work',
  'MH': 'HVAC / elevator work',
  'Electrical': 'Electrical work',
  'EL': 'Electrical work',
  'Boiler': 'Boiler work',
  'BL': 'Boiler work',
  'Sprinkler': 'Fire sprinkler system',
  'SP': 'Fire sprinkler system',
  'Standpipe': 'Firefighting water supply',
  'SD': 'Firefighting water supply',
  'Sign': 'Signage installation',
  'SG': 'Signage installation',
  'Filing': 'Amendment to existing job',
};

const JOB_TYPE_EXPLANATIONS: Record<string, string> = {
  // New construction
  'New Building': 'Construction of an entirely new structure',
  'NB': 'Construction of an entirely new structure',
  // Alterations
  'Alteration': 'Modification to an existing building',
  'Alteration CO': 'Major renovation requiring a new Certificate of Occupancy - changes building use or layout significantly',
  'ALT-CO': 'Major renovation requiring a new Certificate of Occupancy - changes building use or layout significantly',
  'ALT-CO - New Building with Existing Elements to Remain': 'New construction keeping parts of original building (foundation, facade) - requires new C of O',
  'Major Alteration': 'Significant changes affecting structural elements, egress, or use',
  'Minor Alteration': 'Non-structural changes that don\'t affect egress or use',
  'Alteration Type 1': 'Major work affecting exits or occupancy - requires new Certificate of Occupancy',
  'Alteration Type 2': 'Multiple work types without changing exits or occupancy',
  'Alteration Type 3': 'One type of minor work (plumbing, mechanical, etc.)',
  'A1': 'Major work affecting exits or occupancy - requires new Certificate of Occupancy',
  'A2': 'Multiple work types without changing exits or occupancy',
  'A3': 'One type of minor work (plumbing, mechanical, etc.)',
  // Demolition
  'Demolition': 'Partial or full removal of a structure',
  'DM': 'Partial or full removal of a structure',
  'Full Demolition': 'Complete removal of a structure',
  'Partial Demolition': 'Removal of part of a structure',
  // Work types
  'Scaffold': 'Temporary structure for construction access',
  'Equipment': 'Installation of mechanical/electrical equipment',
  'Equipment Work': 'Installation of mechanical/electrical equipment',
  'Plumbing': 'Plumbing system installation or modification',
  'PL': 'Plumbing system installation or modification',
  'Mechanical': 'HVAC, elevators, or other mechanical systems',
  'MH': 'HVAC, elevators, or other mechanical systems',
  'Electrical': 'Electrical system installation or modification',
  'EL': 'Electrical system installation or modification',
  'Boiler': 'Boiler installation, replacement, or modification',
  'BL': 'Boiler installation, replacement, or modification',
  'Sprinkler': 'Fire sprinkler system installation or modification',
  'SP': 'Fire sprinkler system installation or modification',
  'Standpipe': 'Standpipe system for firefighting water supply',
  'SD': 'Standpipe system for firefighting water supply',
  'Sign': 'Installation or modification of building signage',
  'SG': 'Installation or modification of building signage',
  'Filing': 'Subsequent filing or amendment to an existing job',
};

// DOB NOW job status labels (human-readable with status indicators)
const JOB_STATUS_LABELS: Record<string, { label: string; emoji?: string; color?: string; animate?: boolean }> = {
  'Job in Process': { label: 'In Progress', emoji: '◌', color: 'text-blue-600', animate: true },
  'Permit Issued': { label: 'Permitted', emoji: '✓', color: 'text-green-600' },
  'Sign-Off': { label: 'Completed', emoji: '✓', color: 'text-green-600' },
  'LOC Issued': { label: 'Work done & inspected', emoji: '✓', color: 'text-green-600' },
  'Disapproved': { label: 'Disapproved', emoji: '✗', color: 'text-red-600' },
};

// DOB NOW filing status labels (human-readable with status indicators)
const FILING_STATUS_LABELS: Record<string, { label: string; emoji?: string; color?: string }> = {
  'Permit Entire': { label: 'Permit issued, work can start', emoji: '✓', color: 'text-green-600' },
  'Permit Partial': { label: 'Partial permit only', emoji: '◐', color: 'text-amber-600' },
  'LOC Issued': { label: 'Work done & inspected', emoji: '✓', color: 'text-green-600' },
  'Filing Withdrawn': { label: 'Cancelled by applicant', emoji: '✗', color: 'text-red-600' },
  'Filing Rejected': { label: 'Rejected by city', emoji: '✗', color: 'text-red-600' },
  'Filing Complete': { label: 'Application submitted', emoji: '✓', color: 'text-blue-600' },
  'Plan Exam Approved': { label: 'Plans approved, awaiting permit', emoji: '✓', color: 'text-amber-600' },
  'Initial': { label: 'Application started', color: 'text-slate-600' },
};

// Certainty badge colors
const CERTAINTY_STYLES = {
  discussion: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Under discussion' },
  probable: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Likely' },
  certain: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
} as const;

// Nature badge colors
const NATURE_STYLES = {
  densification: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Densification' },
  renovation: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Renovation' },
  infrastructure: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Infrastructure' },
  demolition: { bg: 'bg-red-100', text: 'text-red-700', label: 'Demolition' },
  mixed: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Mixed' },
} as const;

// ZAP (Zoning Application Portal) action code labels
const ZAP_ACTION_LABELS: Record<string, string> = {
  'ZM': 'Zoning Map Amendment',
  'ZR': 'Zoning Text Amendment',
  'ZS': 'Zoning Special Permit',
  'ZA': 'Zoning Authorization',
  'ZC': 'Zoning Certification',
  'CU': 'City ULURP Action',
  'CG': 'Concession',
  'RA': 'Restrictive Declaration',
  'LD': 'Legal Document',
  'ML': 'Modification of Restrictive Declaration',
  'BF': 'Business Improvement District',
  'CM': 'City Map Amendment',
  'CP': 'Curb Cut',
  'DL': 'Disposition for Urban Renewal',
  'EE': 'Enclosed Sidewalk Cafe',
  'EM': 'Easement',
  'HA': 'Housing Plan & Project',
  'HP': 'Housing UDAAP',
  'HR': 'Housing Quality & Safety',
  'HU': 'UDAAP Designation',
  'LL': 'Landfill Concession',
  'ME': 'Major Encroachment',
  'MM': 'Zoning Map Amendment (Modification)',
  'MP': 'Acquisition Site Selection',
  'MY': 'Mayoral Veto',
  'NP': 'Non-ULURP',
  'PA': 'Parking Auth.',
  'PC': 'Public Facility Site Selection',
  'PD': 'PDC Approval',
  'PI': 'Private Improvement',
  'PL': 'Franchise',
  'PM': 'Preliminary Mayoral',
  'PN': 'Plaza Bonus',
  'PQ': 'Plaza Off-site',
  'PP': 'Disposition of Real Property',
  'PS': 'Revocable Consent',
  'RS': 'Renewal Lease',
  'SC': 'Enclosed Sidewalk Cafe',
  'SD': 'Maritime Use Consent',
  'SJ': 'Supplemental Site',
  'SS': 'Site Selection',
  'UE': 'Unenclosed Sidewalk Cafe',
  'VT': 'Vest Pocket Housing',
};

// ZAP status badge styles
const ZAP_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  'Filed': { bg: 'bg-slate-100', text: 'text-slate-600' },
  'Active': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'In Public Review': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Noticed': { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Certified': { bg: 'bg-green-100', text: 'text-green-700' },
  'Complete': { bg: 'bg-green-100', text: 'text-green-700' },
  'Completed': { bg: 'bg-green-100', text: 'text-green-700' },
  'Approved': { bg: 'bg-green-100', text: 'text-green-700' },
  'Denied': { bg: 'bg-red-100', text: 'text-red-700' },
  'Withdrawn': { bg: 'bg-slate-100', text: 'text-slate-500' },
};

// Building occupancy/use codes (NYC DOB classifications)
const OCCUPANCY_LABELS: Record<string, string> = {
  // Vacant (V)
  'V1': 'Vacant Land',
  'V2': 'Vacant Land',
  'V1-VACANT LAND': 'Vacant Land',
  // One & Two Family (A)
  'A1': '1 Family Home',
  'A2': '2 Family Home',
  'A3': '1-2 Family + Store',
  'A4': '1-2 Family + Accessory',
  'A5': '1 Family Attached',
  'A6': '1 Family Summer',
  'A7': '1-2 Family Mansion',
  'A8': 'Bungalow Colony',
  'A9': '1-2 Family Misc',
  // Two-Three Family (B)
  'B1': '2 Family Brick',
  'B2': '2 Family Frame',
  'B3': '2 Family Converted',
  'B9': '2-3 Family Misc',
  // Walk-up Apartments (C)
  'C0': '3+ Family Walk-up',
  'C1': '3 Family Walk-up',
  'C2': '4-6 Family Walk-up',
  'C3': '7-10 Family Walk-up',
  'C4': '11-20 Family Walk-up',
  'C5': '21+ Family Walk-up',
  'C6': 'Coop Walk-up',
  'C7': 'Walk-up + Store',
  'C8': 'Multi-use Walk-up',
  'C9': 'Walk-up Misc',
  // Elevator Apartments (D)
  'D0': 'Elevator Apartment',
  'D1': 'Elevator Semi-fireproof',
  'D2': 'Elevator w/ Stores',
  'D3': 'Elevator Co-op',
  'D4': 'Elevator Condo',
  'D5': 'Elevator Converted',
  'D6': 'Elevator Loft',
  'D7': 'Elevator HDFC',
  'D8': 'Mitchell-Lama',
  'D9': 'Elevator Misc',
  // Warehouses (E)
  'E1': 'Warehouse Fireproof',
  'E2': 'Warehouse Semi-fireproof',
  'E3': 'Warehouse Frame',
  'E4': 'Warehouse w/ Office',
  'E7': 'Self-Storage',
  'E9': 'Warehouse Misc',
  // Factory/Industrial (F)
  'F1': 'Factory Fireproof',
  'F2': 'Factory Semi-fireproof',
  'F4': 'Factory Frame',
  'F5': 'Factory + Office',
  'F8': 'Factory Loft',
  'F9': 'Factory Misc',
  // Garages (G)
  'G0': 'Garage Residential',
  'G1': 'Garage w/ Gas',
  'G2': 'Garage Auto Body',
  'G3': 'Gas Station',
  'G4': 'Gas + Service',
  'G5': 'Car Wash',
  'G6': 'Licensed Parking',
  'G7': 'Unlicensed Parking',
  'G8': 'Garage Government',
  'G9': 'Garage Misc',
  // Hotels (H)
  'H1': 'Luxury Hotel',
  'H2': 'Full Service Hotel',
  'H3': 'Limited Service Hotel',
  'H4': 'Motel',
  'H5': 'Private Club',
  'H6': 'Apartment Hotel',
  'H7': 'SRO Hotel',
  'H8': 'Dormitory',
  'H9': 'Hotel Misc',
  // Hospitals/Health (I)
  'I1': 'Hospital',
  'I2': 'Nursing/Infirmary',
  'I3': 'Mental Health',
  'I4': 'Health Center',
  'I5': 'Dispensary',
  'I6': 'Nursing Home',
  'I7': 'Assisted Living',
  'I9': 'Health Misc',
  // Theatres/Assembly (J)
  'J1': 'Theatre',
  'J2': 'Theatre w/ Stores',
  'J3': 'Motion Picture',
  'J4': 'Legitimate Theatre',
  'J5': 'Concert Hall',
  'J6': 'TV/Radio Studio',
  'J7': 'Athletic Club',
  'J8': 'Nightclub',
  'J9': 'Theatre Misc',
  // Stores (K)
  'K1': 'One Story Store',
  'K2': 'Two Story Store',
  'K3': 'Three Story Store',
  'K4': 'Multi-story Store',
  'K5': 'Department Store',
  'K6': 'Chain Store',
  'K7': 'Mall/Food Court',
  'K8': 'Big Box Store',
  'K9': 'Store Misc',
  // Lofts (L)
  'L1': 'Loft Fireproof',
  'L2': 'Loft Semi-fireproof',
  'L3': 'Loft Frame',
  'L8': 'Loft w/ Retail',
  'L9': 'Loft Misc',
  // Religious (M)
  'M1': 'Church',
  'M2': 'Mission House',
  'M3': 'Parsonage',
  'M4': 'Convent',
  'M9': 'Religious Misc',
  // Asylums/Homes (N)
  'N1': 'Asylum',
  'N2': 'Home for Aged',
  'N3': 'Orphanage',
  'N4': 'Detention',
  'N9': 'Asylum Misc',
  // Office Buildings (O)
  'O1': 'Office (1 Story)',
  'O2': 'Office (2-6 Stories)',
  'O3': 'Office (7-19 Stories)',
  'O4': 'Office (20+ Stories)',
  'O5': 'Office + Bank',
  'O6': 'Office + Stores',
  'O7': 'Office Co-op',
  'O8': 'Office Condo',
  'O9': 'Office Misc',
  // Amusement (P)
  'P1': 'Arena/Auditorium',
  'P2': 'Stadium',
  'P3': 'Amusement Park',
  'P4': 'Beach/Pool',
  'P5': 'Golf Course',
  'P6': 'Tennis/Sports',
  'P7': 'Boat Marina',
  'P8': 'Racetrack',
  'P9': 'Amusement Misc',
  // Parks/Government (Q)
  'Q0': 'Park/Playground',
  'Q1': 'Park Land',
  'Q2': 'Playground',
  'Q3': 'Outdoor Pool',
  'Q4': 'Beach',
  'Q5': 'Golf Course',
  'Q6': 'Stadium Grounds',
  'Q7': 'Tennis Courts',
  'Q8': 'Marina',
  'Q9': 'Parks Misc',
  // Condos (R)
  'R0': 'Condo General',
  'R1': 'Condo Residential 1-3',
  'R2': 'Condo Residential 4-6',
  'R3': 'Condo Residential 7-9',
  'R4': 'Condo Residential 10+',
  'R5': 'Condo Misc Residence',
  'R6': 'Condo w/ Stores',
  'R7': 'Condo (Commercial)',
  'R8': 'Condo (Co-op)',
  'R9': 'Condo Misc',
  // Residence - Mixed (S)
  'S0': 'Mixed Use w/ Residence',
  'S1': 'Mixed 1-4 Family',
  'S2': 'Mixed 5-6 Family',
  'S3': 'Mixed 7-19 Family',
  'S4': 'Mixed 20+ Family',
  'S5': 'Mixed Professional',
  'S9': 'Mixed Misc',
  // Transportation (T)
  'T1': 'Airport',
  'T2': 'Pier/Dock',
  'T9': 'Transport Misc',
  // Utility (U)
  'U0': 'Utility',
  'U1': 'Bridge/Tunnel',
  'U2': 'Gas/Electric',
  'U3': 'Ceiling Railroad',
  'U4': 'Comm Franchise',
  'U5': 'Telecom',
  'U6': 'Railroad Station',
  'U7': 'Transportation',
  'U8': 'Canal',
  'U9': 'Utility Misc',
  // Vacant (V)
  'V0': 'Zoned Residential',
  'V3': 'Zoned Commercial',
  'V5': 'Zoned Cemetery',
  'V7': 'Zoned Agriculture',
  'V8': 'Zoned Parking',
  'V9': 'Vacant Misc',
  // Educational (W)
  'W1': 'School (Public Elementary)',
  'W2': 'School (Public Jr High)',
  'W3': 'School (Public Secondary)',
  'W4': 'School (Private)',
  'W5': 'College/University',
  'W6': 'Trade School',
  'W7': 'Pre-K/Nursery',
  'W8': 'Parochial School',
  'W9': 'Education Misc',
  // Government (Y)
  'Y1': 'Fire Station',
  'Y2': 'Police Station',
  'Y3': 'Prison',
  'Y4': 'Military',
  'Y5': 'Municipal',
  'Y6': 'Government Office',
  'Y7': 'Post Office',
  'Y8': 'Government Misc',
  'Y9': 'Government Land',
  // Misc (Z)
  'Z0': 'Tennis Courts',
  'Z1': 'Cemetery/Crematory',
  'Z2': 'Cemetery',
  'Z3': 'Crematory',
  'Z4': 'Forest/Wildlife',
  'Z5': 'Vacant Land (Forest)',
  'Z7': 'Ballfield',
  'Z8': 'Vacant (Misc)',
  'Z9': 'Misc',
};

// Special zoning district labels
const ZONE_LABELS: Record<string, { label: string; description: string }> = {
  // Mandatory Inclusionary Housing
  'MIH': { label: 'MIH', description: 'Mandatory Inclusionary Housing - requires affordable units in new buildings' },
  'MIH AREA': { label: 'MIH', description: 'Mandatory Inclusionary Housing - requires affordable units in new buildings' },

  // Anti-Harassment Districts
  'GW': { label: 'Anti-Harassment', description: 'Greenpoint-Williamsburg Anti-Harassment Area - extra protections against tenant harassment in rezoned areas' },
  'GWAH': { label: 'Anti-Harassment', description: 'Greenpoint-Williamsburg Anti-Harassment Area - extra protections against tenant harassment' },
  'CH': { label: 'Anti-Harassment', description: 'Coney Island Anti-Harassment Area - protections against tenant harassment' },
  'CI': { label: 'Anti-Harassment', description: 'Coney Island Special District - mixed-use amusement/residential area' },
  'HR': { label: 'Anti-Harassment', description: 'Hudson River Park Anti-Harassment Area' },
  'WCH': { label: 'Anti-Harassment', description: 'West Chelsea Anti-Harassment Area' },

  // Industrial/Business Zones
  'IBZ': { label: 'IBZ', description: 'Industrial Business Zone - protected industrial area, manufacturing encouraged' },
  'IN': { label: 'Industrial', description: 'Industrial Special District - manufacturing and industrial uses' },
  'EC': { label: 'Econ Dev', description: 'Economic Development Zone - tax incentives for businesses' },

  // Food/Retail
  'FRESH': { label: 'FRESH', description: 'Food Retail Expansion - incentives for fresh food grocery stores in underserved areas' },

  // Housing Programs
  'HPD': { label: 'HPD', description: 'Housing Preservation & Development designated area' },
  'SRO': { label: 'SRO', description: 'Single Room Occupancy - restrictions on converting SRO housing' },
  'IHDA': { label: 'IHDA', description: 'Inclusionary Housing Designated Area - affordable housing bonuses available' },

  // Waterfront
  'WF': { label: 'Waterfront', description: 'Waterfront Access Plan area - public access requirements along water' },
  'WD': { label: 'Waterfront', description: 'Waterfront District - special rules for waterfront development' },

  // Transit-Oriented
  'TA': { label: 'Transit', description: 'Transit-Adjacent - higher density near subway stations' },
  'TOD': { label: 'Transit', description: 'Transit-Oriented Development - density bonuses near transit' },

  // Historic/Special Character
  'HP': { label: 'Historic', description: 'Historic Preservation overlay - protects historic character' },
  'LPC': { label: 'Landmark', description: 'Landmarks Preservation Commission designated area' },
  'HY': { label: 'Historic', description: 'Historic District - special preservation rules' },
  'SD': { label: 'Special Dist', description: 'Special District - unique zoning rules for specific area' },

  // Named Special Districts (Manhattan)
  'CL': { label: 'Clinton', description: 'Special Clinton District - preserving Hell\'s Kitchen neighborhood character' },
  'GC': { label: 'Grand Cent', description: 'Grand Central Special District - enhanced transit area' },
  'HK': { label: 'Hudson Yards', description: 'Special Hudson Yards District - major development zone' },
  'HU': { label: 'Harlem', description: 'Special Harlem District - neighborhood preservation and development' },
  'LI': { label: 'Little Italy', description: 'Special Little Italy District - preserve neighborhood character' },
  'LC': { label: 'Lincoln Sq', description: 'Special Lincoln Square District' },
  'LS': { label: 'Lower Manhattan', description: 'Special Lower Manhattan District' },
  'MX': { label: 'Mixed Use', description: 'Special Mixed Use District - combining residential and commercial' },
  'MP': { label: 'Midtown', description: 'Special Midtown District - high-density commercial' },
  'PE': { label: 'Penn Sta', description: 'Special Penn Station District - transit-oriented development' },
  'TA125': { label: '125th St', description: 'Special 125th Street District - Harlem commercial corridor' },
  'TH': { label: 'Theatre', description: 'Special Theatre District - preserving Broadway theatres' },
  'TMU': { label: 'Tribeca', description: 'Special Tribeca Mixed Use District' },
  'UN': { label: 'UN', description: 'Special United Nations Development District' },

  // Named Special Districts (Brooklyn)
  'BR': { label: 'Bay Ridge', description: 'Special Bay Ridge District' },
  'CD': { label: 'Crown Heights', description: 'Special Crown Heights District' },
  'DB': { label: 'Downtown BK', description: 'Special Downtown Brooklyn District - high-density mixed use' },
  'DT': { label: 'DUMBO', description: 'Special DUMBO District' },
  'OP': { label: 'Ocean Pkwy', description: 'Special Ocean Parkway District' },
  'SB': { label: 'Sheepshead', description: 'Special Sheepshead Bay District' },

  // Named Special Districts (Queens)
  'CD-Q': { label: 'Court Sq', description: 'Special Court Square District - Long Island City' },
  'DL': { label: 'Dutch Kills', description: 'Special Dutch Kills Subdistrict' },
  'FA': { label: 'Flushing', description: 'Special Flushing District - downtown Flushing' },
  'FH': { label: 'Forest Hills', description: 'Special Forest Hills District' },
  'LIC': { label: 'Long Island City', description: 'Special Long Island City District' },
  'WP': { label: 'Willets Pt', description: 'Special Willets Point District' },

  // Named Special Districts (Bronx)
  'FP': { label: 'Fordham', description: 'Special Fordham Road District' },
  'HB': { label: 'Hunts Point', description: 'Special Hunts Point District' },
  'JC': { label: 'Jerome', description: 'Special Jerome Corridor District' },

  // Named Special Districts (Staten Island)
  'HG': { label: 'Hillsides', description: 'Special Hillsides Preservation District' },
  'NA': { label: 'Natural Area', description: 'Special Natural Area District - environmental protection' },
  'SC': { label: 'St. George', description: 'Special St. George District' },
  'SG': { label: 'South Richmond', description: 'Special South Richmond Development District' },

  // Environmental
  'EC-1': { label: 'Coastal', description: 'Coastal Flood Zone - special resilience requirements' },
  'FL': { label: 'Flood Zone', description: 'Special Flood Hazard Area - elevation requirements' },
  'WR': { label: 'Wetland', description: 'Wetland buffer area - environmental restrictions' },
};

// Activity Timeline component with collapsible closed complaints
interface SourceSummary {
  sourceType: string;
  sourceId?: string;
  description: string;
  agency?: string;
  projectType?: string;
  filedDate?: string;
  officialUrl?: string;
  dobNowDetails?: {
    bin?: string;
    jobStatus?: string;
    filingStatus?: string;
    jobType?: string;
    floors?: string;
  };
  complaintDetails?: {
    status: string;
    category: string;
    categoryCode: string;
    disposition?: string;
    inspectionDate?: string;
  };
  zapDetails?: {
    projectName: string;
    projectBrief?: string;
    publicStatus: string;
    isUlurp: boolean;
    actions?: string[];
    ulurpNumbers?: string[];
    ceqrNumber?: string;
    currentMilestone?: string;
    currentMilestoneDate?: string;
    certifiedDate?: string;
    applicant?: string;
    applicantType?: string;
    communityDistrict?: string;
  };
}

// Helper to check if a job is completed
const COMPLETED_JOB_STATUSES = ['LOC Issued', 'Sign-Off'];

function ActivityTimeline({ sources, formatDate, bin }: { sources?: SourceSummary[]; formatDate: (d: string | undefined | null) => string; bin?: string }) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hideClosedComplaints, setHideClosedComplaints] = useState(true);

  if (!sources || sources.length === 0) return null;

  // Group similar sources by month + type + description
  type SourceGroup = {
    key: string;
    month: string;
    sourceType: string;
    description: string;
    items: SourceSummary[];
    officialUrl?: string;
    agency?: string;
    projectType?: string;
  };

  const groups: SourceGroup[] = [];
  const groupMap = new Map<string, SourceGroup>();

  for (const source of sources) {
    const month = source.filedDate ? formatDate(source.filedDate) : 'No date';
    const key = `${month}|${source.sourceType}|${source.description}`;

    if (groupMap.has(key)) {
      groupMap.get(key)!.items.push(source);
    } else {
      const group: SourceGroup = {
        key,
        month,
        sourceType: source.sourceType,
        description: source.description,
        items: [source],
        officialUrl: source.officialUrl,
        agency: source.agency,
        projectType: source.projectType,
      };
      groupMap.set(key, group);
      groups.push(group);
    }
  }

  // Find complaints URL and count (same for all complaints at this building)
  const complaints = sources.filter(s => s.complaintDetails);
  const closedComplaints = complaints.filter(c => c.complaintDetails?.status === 'CLOSED');
  const complaintsUrl = complaints[0]?.officialUrl;
  const complaintsCount = complaints.length;
  const closedComplaintsCount = closedComplaints.length;

  // Filter groups based on hideClosedComplaints toggle
  const filteredGroups = hideClosedComplaints
    ? groups.filter(group => {
        const complaint = group.items[0]?.complaintDetails;
        return !(complaint?.status === 'CLOSED');
      })
    : groups;

  const toggleExpand = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900">
          Activity ({filteredGroups.length}{hideClosedComplaints && closedComplaintsCount > 0 ? ` / ${groups.length}` : ''})
        </h3>
        <div className="flex items-center gap-3">
          {closedComplaintsCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={hideClosedComplaints}
                onChange={(e) => setHideClosedComplaints(e.target.checked)}
                className="w-3 h-3 rounded border-slate-300"
              />
              Hide {closedComplaintsCount} closed
            </label>
          )}
          {complaintsUrl && (
            <a
              href={complaintsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              View {complaintsCount}x on BISWeb →
            </a>
          )}
        </div>
      </div>
      <div className="relative">
        {/* Vertical timeline line */}
        <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-200" />

        <div className="space-y-0">
          {filteredGroups.map((group) => {
            const complaint = group.items[0]?.complaintDetails;
            const dobNow = group.items[0]?.dobNowDetails;
            const isClosed = complaint?.status === 'CLOSED';
            const isWithdrawn = dobNow?.filingStatus?.toLowerCase().includes('withdrawn');
            const isCompleted = dobNow?.jobStatus && COMPLETED_JOB_STATUSES.includes(dobNow.jobStatus);
            const isExpanded = expandedItems.has(group.key);
            const isCollapsible = (isClosed && complaint) || isWithdrawn || isCompleted;
            const isDimmed = (isClosed || isWithdrawn) && !isExpanded;

            return (
              <div
                key={group.key}
                className={`relative flex gap-4 pb-4 last:pb-0 ${isDimmed ? 'opacity-60' : ''}`}
              >
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full bg-white border-2 ${
                    isCompleted ? 'border-green-400' :
                    group.items.length > 1 ? 'border-blue-400' :
                    (isClosed || isWithdrawn) ? 'border-slate-200' : 'border-slate-300'
                  } flex items-center justify-center`}>
                    {isCompleted ? (
                      <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : group.items.length > 1 ? (
                      <span className="text-[10px] font-medium text-blue-600">{group.items.length}</span>
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${(isClosed || isWithdrawn) ? 'bg-slate-300' : 'bg-slate-400'}`} />
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {/* Header row: Date, type, IDs, status - clickable for closed complaints */}
                  <div
                    className={`flex items-center gap-2 flex-wrap ${isCollapsible ? 'cursor-pointer' : ''}`}
                    onClick={isCollapsible ? () => toggleExpand(group.key) : undefined}
                  >
                    <span className={`text-sm font-semibold tabular-nums ${(isClosed || isWithdrawn) ? 'text-slate-500' : 'text-slate-900'}`}>
                      {group.month}
                    </span>
                    {/* Type with optional tooltip */}
                    {(() => {
                      const explanation = JOB_TYPE_EXPLANATIONS[group.sourceType] || JOB_TYPE_EXPLANATIONS[group.description];
                      const isViolationType = group.sourceType === 'Violation';
                      const isCivilPenalty = group.sourceType === 'Civil Penalty';

                      if (isViolationType) {
                        return (
                          <span className="text-sm font-medium text-red-600">
                            ⚠ Violation
                          </span>
                        );
                      }
                      if (isCivilPenalty) {
                        return (
                          <Tooltip content="DOB NOW civil penalty - monetary fine for code violations" position="top">
                            <span className="text-sm font-medium text-orange-600 cursor-help">
                              ⚠ Civil Penalty
                            </span>
                          </Tooltip>
                        );
                      }
                      if (explanation) {
                        return (
                          <Tooltip content={explanation} position="top">
                            <span className={`text-sm cursor-help border-b border-dotted ${(isClosed || isWithdrawn) ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-400'}`}>
                              {group.sourceType}
                            </span>
                          </Tooltip>
                        );
                      }
                      return (
                        <span className={`text-sm ${(isClosed || isWithdrawn) ? 'text-slate-400' : 'text-slate-600'}`}>
                          {group.sourceType}
                        </span>
                      );
                    })()}
                    {group.items.length > 1 && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        ×{group.items.length}
                      </span>
                    )}
                    {/* IDs inline - ZAP/Violations link to portals, others copy */}
                    {group.items.map((item, i) => {
                      if (!item.sourceId) return null;
                      const isZap = item.zapDetails || group.sourceType === 'ULURP Filed' || group.sourceType === 'ZAP';
                      const isViolation = group.sourceType === 'Violation';
                      const isCivilPenalty = group.sourceType === 'Civil Penalty';
                      if (isZap) {
                        return (
                          <span key={i} onClick={(e) => e.stopPropagation()}>
                            <ExternalLinkBadge
                              label={item.sourceId!}
                              href={`https://zap.planning.nyc.gov/projects/${item.sourceId}`}
                              tooltip="View on ZAP Portal (Zoning Application Portal)"
                            />
                          </span>
                        );
                      }
                      if (isViolation && bin) {
                        return (
                          <span key={i} onClick={(e) => e.stopPropagation()}>
                            <ExternalLinkBadge
                              label={item.sourceId!}
                              href={`https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?requestid=0&bin=${bin}`}
                              tooltip="View property profile on BISWeb"
                            />
                          </span>
                        );
                      }
                      if (isCivilPenalty) {
                        return (
                          <span key={i} onClick={(e) => e.stopPropagation()}>
                            <ExternalLinkBadge
                              label={item.sourceId!}
                              href="https://a810-dobnow.nyc.gov/publish/Index.html#!/search"
                              tooltip="Search on DOB NOW (copy violation number)"
                            />
                          </span>
                        );
                      }
                      const isComplaint = !!item.complaintDetails;
                      if (isComplaint && bin) {
                        return (
                          <span key={i} onClick={(e) => e.stopPropagation()}>
                            <ExternalLinkBadge
                              label={item.sourceId!}
                              href={`https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?requestid=0&bin=${bin}`}
                              tooltip="View complaint on BISWeb"
                            />
                          </span>
                        );
                      }
                      const isWithdrawn = item.dobNowDetails?.filingStatus?.toLowerCase().includes('withdrawn');
                      return (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(item.sourceId!);
                          }}
                          title={isWithdrawn ? "Withdrawn - Click to copy" : "Click to copy"}
                          className={`text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer font-mono ${isWithdrawn ? 'line-through opacity-60' : ''}`}
                        >
                          {item.sourceId}
                        </button>
                      );
                    })}
                    {/* Expand indicator for closed complaints */}
                    {isCollapsible && (
                      <span className="text-xs text-slate-400 ml-auto">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                  </div>

                  {/* Expanded content OR non-complaint content */}
                  {(!isCollapsible || isExpanded) && (
                    <>
                      {/* Description */}
                      {(() => {
                        if (complaint) {
                          if (complaint.category.startsWith('Category ')) return null;
                          return (
                            <div className={`text-sm mt-0.5 ${isClosed ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Tooltip content={`Code: ${complaint.categoryCode}`} position="top">
                                <span className="cursor-help border-b border-dotted border-slate-300">
                                  {complaint.category}
                                </span>
                              </Tooltip>
                            </div>
                          );
                        }
                        // Skip description if it matches sourceType or DOB NOW jobType (avoid duplication)
                        const dobJobType = group.items.find(item => item.dobNowDetails)?.dobNowDetails?.jobType;
                        if (group.description !== group.sourceType && group.description !== dobJobType) {
                          const explanation = JOB_TYPE_EXPLANATIONS[group.description];
                          if (explanation) {
                            return (
                              <div className="text-sm text-slate-500 mt-0.5">
                                <Tooltip content={explanation} position="top">
                                  <span className="cursor-help border-b border-dotted border-slate-400">
                                    {group.description}
                                  </span>
                                </Tooltip>
                              </div>
                            );
                          }
                          return <div className="text-sm text-slate-500 mt-0.5">{group.description}</div>;
                        }
                        return null;
                      })()}

                      {/* Metadata row */}
                      {(() => {
                        const isComplaint = !!complaint;
                        // Skip all DOB NOW links (available in Useful Links)
                        const isGenericDobNow = group.officialUrl?.includes('a810-dobnow.nyc.gov');
                        // Skip CEQR generic search links (user can use Useful Links instead)
                        const isGenericCeqr = group.officialUrl === 'https://a002-ceqraccess.nyc.gov/ceqr/';
                        // Skip ZAP links (ID is now clickable in header)
                        const isZap = group.officialUrl?.includes('zap.planning.nyc.gov');
                        // Skip Violation/Civil Penalty links (ID is now clickable with ExternalLinkBadge)
                        const isViolation = group.sourceType === 'Violation';
                        const isCivilPenalty = group.sourceType === 'Civil Penalty';
                        const showUrl = group.officialUrl && !isComplaint && !isGenericDobNow && !isGenericCeqr && !isZap && !isViolation && !isCivilPenalty;
                        // Skip projectType if it matches DOB NOW jobType (avoid duplication)
                        const dobJobType = group.items.find(item => item.dobNowDetails)?.dobNowDetails?.jobType;
                        const showProjectType = group.projectType && group.projectType !== dobJobType;
                        if (!group.agency && !showProjectType && !showUrl) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                            {group.agency && <span>{group.agency}</span>}
                            {showProjectType && <span>{group.projectType}</span>}
                            {showUrl && (
                              <a href={group.officialUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline">
                                View →
                              </a>
                            )}
                          </div>
                        );
                      })()}

                      {/* DOB NOW enriched details - hidden when completed and collapsed */}
                      {(() => {
                        const firstWithDetails = group.items.find(item => item.dobNowDetails);
                        if (!firstWithDetails?.dobNowDetails) return null;
                        const dob = firstWithDetails.dobNowDetails;
                        const isWithdrawnLocal = dob.filingStatus?.toLowerCase().includes('withdrawn');
                        const isCompletedLocal = dob.jobStatus && COMPLETED_JOB_STATUSES.includes(dob.jobStatus);
                        // Hide details if completed/withdrawn and collapsed
                        if ((isCompletedLocal || isWithdrawnLocal) && !isExpanded) return null;
                        return (
                          <div className={`mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 gap-y-1 text-xs ${isWithdrawnLocal ? 'opacity-50' : ''}`}>
                            {/* Show filing status first if withdrawn, otherwise show job status */}
                            {isWithdrawnLocal ? (
                              <>
                                <span className="text-slate-400">Status</span>
                                <span className="text-red-600 font-medium">✗ Withdrawn</span>
                              </>
                            ) : dob.jobStatus && (() => {
                              const status = JOB_STATUS_LABELS[dob.jobStatus];
                              const label = status?.label || dob.jobStatus;
                              const color = status?.color || 'text-slate-600';
                              return (
                                <>
                                  <span className="text-slate-400">Status</span>
                                  <span className={`${color} font-medium flex items-center gap-1`}>
                                    {status?.animate ? (
                                      <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    ) : status?.emoji ? (
                                      <span>{status.emoji}</span>
                                    ) : null}
                                    {label}
                                  </span>
                                </>
                              );
                            })()}
                            {!isWithdrawn && dob.filingStatus && (() => {
                              // Hide Filing if it shows the same as Job Status (redundant)
                              const jobStatusLabel = dob.jobStatus ? (JOB_STATUS_LABELS[dob.jobStatus]?.label || dob.jobStatus) : null;
                              const status = FILING_STATUS_LABELS[dob.filingStatus];
                              const label = status?.label || dob.filingStatus;
                              if (label === jobStatusLabel) return null;
                              const color = status?.color || 'text-slate-600';
                              return (
                                <>
                                  <span className="text-slate-400">Filing</span>
                                  <span className={`${color} font-medium`}>
                                    {status?.emoji && <span className="mr-1">{status.emoji}</span>}
                                    {label}
                                  </span>
                                </>
                              );
                            })()}
                            {dob.jobType && (() => {
                              const label = JOB_TYPE_LABELS[dob.jobType] || dob.jobType;
                              const explanation = JOB_TYPE_EXPLANATIONS[dob.jobType];
                              // Include DOB code in tooltip if label differs from raw code
                              const tooltipContent = explanation
                                ? (label !== dob.jobType ? `${dob.jobType} — ${explanation}` : explanation)
                                : (label !== dob.jobType ? `DOB code: ${dob.jobType}` : null);
                              return (
                                <>
                                  <span className="text-slate-400">Project</span>
                                  {tooltipContent ? (
                                    <Tooltip content={tooltipContent} position="top">
                                      <span className="text-slate-600 cursor-help border-b border-dotted border-slate-300">
                                        {label}
                                      </span>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-slate-600">{label}</span>
                                  )}
                                </>
                              );
                            })()}
                            {dob.floors && (() => {
                              const rangeMatch = dob.floors.match(/(\d+)\s+through\s+(\d+)/i);
                              if (rangeMatch?.[1] && rangeMatch?.[2]) {
                                // Unify if min=max (001-001 → 001)
                                const floorDisplay = rangeMatch[1] === rangeMatch[2]
                                  ? rangeMatch[1]
                                  : `${rangeMatch[1]}-${rangeMatch[2]}`;
                                return (
                                  <>
                                    <span className="text-slate-400">Floor{rangeMatch[1] !== rangeMatch[2] ? 's' : ''}</span>
                                    <span className="text-slate-600">{floorDisplay}</span>
                                  </>
                                );
                              }
                              const floors = dob.floors.split(',').map(f => f.trim()).filter(Boolean);
                              return (
                                <>
                                  <span className="text-slate-400">Floor{floors.length > 1 ? 's' : ''}</span>
                                  <span className="text-slate-600">{floors.length === 1 ? floors[0] : `${floors.length} floors`}</span>
                                </>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Complaint enriched details */}
                      {(() => {
                        const firstWithComplaint = group.items.find(item => item.complaintDetails);
                        if (!firstWithComplaint?.complaintDetails) return null;
                        const c = firstWithComplaint.complaintDetails;
                        const dispositionExplanation = c.disposition ? DISPOSITION_EXPLANATIONS[c.disposition] : undefined;

                        // Calculate delay
                        const filedDate = firstWithComplaint.filedDate ? new Date(firstWithComplaint.filedDate) : null;
                        const inspectionDate = c.inspectionDate ? new Date(c.inspectionDate) : null;
                        let delayText = '';
                        if (filedDate && inspectionDate && inspectionDate > filedDate) {
                          const diffDays = Math.floor((inspectionDate.getTime() - filedDate.getTime()) / (1000 * 60 * 60 * 24));
                          if (diffDays < 7) delayText = diffDays === 1 ? '1 day later' : `${diffDays} days later`;
                          else if (diffDays < 30) delayText = `${Math.floor(diffDays / 7)} weeks later`;
                          else if (diffDays < 365) delayText = `${Math.floor(diffDays / 30)} months later`;
                          else {
                            const years = Math.floor(diffDays / 365);
                            const months = Math.floor((diffDays % 365) / 30);
                            delayText = months > 0 ? `${years}y ${months}mo later` : `${years} year${years > 1 ? 's' : ''} later`;
                          }
                        }

                        return (
                          <div className="mt-1.5 space-y-1">
                            {c.inspectionDate && (
                              <div className="text-xs text-slate-400">
                                <Tooltip content="Date when DOB inspector visited the property" position="right">
                                  <span className="cursor-help border-b border-dotted border-slate-300">Inspection</span>
                                </Tooltip>
                                : {c.inspectionDate}
                                {delayText && <span> ({delayText})</span>}
                              </div>
                            )}
                            {c.disposition && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400">Outcome:</span>
                                {dispositionExplanation ? (
                                  <Tooltip content={dispositionExplanation} position="top">
                                    <span className={`cursor-help border-b border-dotted ${isClosed ? 'text-slate-500 border-slate-300' : 'text-slate-600 border-slate-400'}`}>
                                      {c.disposition}
                                    </span>
                                  </Tooltip>
                                ) : (
                                  <span className={isClosed ? 'text-slate-500' : 'text-slate-600'}>{c.disposition}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ZAP project enriched details */}
                      {(() => {
                        const firstWithZap = group.items.find(item => item.zapDetails);
                        if (!firstWithZap?.zapDetails) return null;
                        const zap = firstWithZap.zapDetails;
                        const statusStyle = ZAP_STATUS_STYLES[zap.publicStatus] || { bg: 'bg-slate-100', text: 'text-slate-600' };

                        return (
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                            {/* Status badge */}
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {zap.publicStatus}
                              </span>
                            </div>

                            {/* Project brief */}
                            {zap.projectBrief && (
                              <p className="text-xs text-slate-600 leading-relaxed">{zap.projectBrief}</p>
                            )}

                            {/* Actions and ULURP numbers */}
                            {zap.actions && zap.actions.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs text-slate-400">Zoning Actions:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {zap.actions.map((action, idx) => {
                                    const label = ZAP_ACTION_LABELS[action] || action;
                                    const ulurpNum = zap.ulurpNumbers?.[idx];
                                    if (ulurpNum) {
                                      return (
                                        <ExternalLinkBadge
                                          key={idx}
                                          label={label}
                                          href={`https://zap.planning.nyc.gov/projects?applied-filters=project_applicant_text&project_applicant_text=${encodeURIComponent(ulurpNum)}`}
                                          tooltip={`ULURP (Uniform Land Use Review Procedure): ${ulurpNum}`}
                                        />
                                      );
                                    }
                                    return (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600"
                                      >
                                        {label}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Current milestone */}
                            {zap.currentMilestone && (
                              <div className="text-xs">
                                <span className="text-slate-400">Current step: </span>
                                <span className="text-slate-600">{zap.currentMilestone}</span>
                              </div>
                            )}

                            {/* Applicant */}
                            {zap.applicant && (
                              <div className="text-xs">
                                <span className="text-slate-400">Applicant: </span>
                                <span className="text-slate-600">{zap.applicant}</span>
                                {zap.applicantType && <span className="text-slate-400"> ({zap.applicantType})</span>}
                              </div>
                            )}

                            {/* CEQR number - link to portal with number in URL for easy copy-paste */}
                            {zap.ceqrNumber && (
                              <div className="text-xs flex items-center gap-2">
                                <Tooltip content="City Environmental Quality Review - environmental impact assessment" position="top">
                                  <span className="text-slate-400 cursor-help border-b border-dotted border-slate-300">CEQR:</span>
                                </Tooltip>
                                <ExternalLinkBadge
                                  label={zap.ceqrNumber}
                                  href={`https://a002-ceqraccess.nyc.gov/ceqr/?${zap.ceqrNumber}`}
                                  tooltip="Open CEQR portal (number in URL for easy copy-paste)"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DetailPanel() {
  const { closeDetailPanel } = useViewStore();
  const { data: detail, isLoading, error } = usePlaceDetail(true);

  // Resizable panel state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleClose = useCallback(() => {
    closeDetailPanel();
  }, [closeDetailPanel]);

  // Format a date for display
  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      // Calculate new width (dragging left increases width since panel is on right)
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="absolute top-0 right-0 h-full bg-white shadow-2xl z-20 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors group"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-slate-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ) : detail ? (
            <>
              <h2 className="text-lg font-semibold text-slate-900 truncate">
                {detail.transformation?.headline ?? 'Loading...'}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-500">
                  {detail.place.address}
                </span>
                {/* Property status badges */}
                {(() => {
                  const prop = detail.propertyDetails;
                  if (!prop) return null;
                  const bin = prop.bin;
                  const violationsUrl = bin ? `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?requestid=0&bin=${bin}` : null;

                  // ─────────────────────────────────────────────────────────────
                  // EXCLUSIVE BADGES (only one of each type)
                  // ─────────────────────────────────────────────────────────────

                  // Occupancy: one building use (blue)
                  const occupancy = prop.occupancy;
                  const occupancyCode = occupancy?.split('-')[0]?.trim();
                  const occupancyLabel = occupancyCode ? (OCCUPANCY_LABELS[occupancy!] || OCCUPANCY_LABELS[occupancyCode] || occupancy) : null;

                  // Zone: one special district (purple)
                  const zone = prop.specialArea;
                  const zoneKey = zone?.replace(' - ', ' ').replace('MIH AREA', 'MIH').split(' ')[0];
                  const zoneInfo = zoneKey ? (ZONE_LABELS[zoneKey] || ZONE_LABELS[zone!]) : null;

                  // ─────────────────────────────────────────────────────────────
                  // STACKABLE BADGES (can have multiple)
                  // ─────────────────────────────────────────────────────────────

                  // Property status flags (gray/amber) - can stack
                  const statusFlags: { label: string; color: string }[] = [];
                  if (prop.landmarkStatus) statusFlags.push({ label: 'Landmark', color: 'bg-amber-100 text-amber-700' });
                  if (prop.cityOwned) statusFlags.push({ label: 'City-Owned', color: 'bg-slate-200 text-slate-700' });
                  if (prop.condo) statusFlags.push({ label: 'Condo', color: 'bg-slate-200 text-slate-700' });
                  if (prop.vacant && !occupancyLabel?.includes('Vacant')) statusFlags.push({ label: 'Vacant', color: 'bg-slate-200 text-slate-700' });

                  // Violations (red) - can stack, shown as single clickable badge
                  const violationFlags: string[] = [];
                  if (prop.hasClass1Violation) violationFlags.push('Class 1 Violation');
                  if (prop.hasStopWork) violationFlags.push('Stop Work');
                  if (prop.hasPadlock) violationFlags.push('Padlock');
                  if (prop.hasVacateOrder) violationFlags.push('Vacate Order');

                  // Hold flags (amber) - can stack
                  const holdFlags: { label: string; color: string }[] = [];
                  if (prop.filingOnHold) holdFlags.push({ label: 'Filing Hold', color: 'bg-amber-100 text-amber-700' });
                  if (prop.approvalOnHold) holdFlags.push({ label: 'Approval Hold', color: 'bg-amber-100 text-amber-700' });

                  // ─────────────────────────────────────────────────────────────

                  const hasBadges = occupancyLabel || zone || statusFlags.length > 0 || violationFlags.length > 0 || holdFlags.length > 0;
                  if (!hasBadges) return null;

                  const badgeBase = 'text-[10px] leading-none px-1.5 py-1 rounded inline-flex items-center';

                  return (
                    <>
                      {/* Exclusive: Occupancy (blue) */}
                      {occupancyLabel && (
                        <Tooltip content={`Building use: ${occupancy}`} position="top">
                          <span className={`${badgeBase} bg-blue-50 text-blue-700 cursor-help`}>
                            {occupancyLabel}
                          </span>
                        </Tooltip>
                      )}

                      {/* Exclusive: Zone (purple) */}
                      {zone && (
                        <Tooltip content={zoneInfo?.description || `Special zoning: ${zone}`} position="top">
                          <span className={`${badgeBase} bg-purple-50 text-purple-700 cursor-help`}>
                            {zoneInfo?.label || zoneKey || zone}
                          </span>
                        </Tooltip>
                      )}

                      {/* Stackable: Status flags (gray/amber) */}
                      {statusFlags.map((flag, i) => (
                        <span key={`s-${i}`} className={`${badgeBase} ${flag.color}`}>
                          {flag.label}
                        </span>
                      ))}

                      {/* Stackable: Violations (red, combined into one clickable badge) */}
                      {violationFlags.length > 0 && violationsUrl && (
                        <ExternalLinkBadge
                          label={violationFlags.join(', ')}
                          href={violationsUrl}
                          tooltip="View violations on BISWeb"
                        />
                      )}
                      {violationFlags.length > 0 && !violationsUrl && violationFlags.map((label, i) => (
                        <span key={`v-${i}`} className={`${badgeBase} bg-red-100 text-red-700`}>
                          {label}
                        </span>
                      ))}

                      {/* Stackable: Hold flags (amber) */}
                      {holdFlags.map((flag, i) => (
                        <span key={`h-${i}`} className={`${badgeBase} ${flag.color}`}>
                          {flag.label}
                        </span>
                      ))}
                    </>
                  );
                })()}
              </div>
            </>
          ) : null}
        </div>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-slate-100 rounded-md transition-colors ml-2"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-20 bg-slate-100 rounded" />
            <div className="h-32 bg-slate-100 rounded" />
            <div className="h-24 bg-slate-100 rounded" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg">
            Failed to load details. Please try again.
          </div>
        )}

        {detail && detail.transformation && (
          <div className="space-y-6">
            {/* Timeline dates */}
            {(() => {
              const t = detail.transformation;
              const items: { label: string; date: string }[] = [];

              if (t.disruptionStart) {
                const label = t.isEstimatedStart ? 'Permit issued' : 'Construction started';
                items.push({ label: `${label}: ${formatDate(t.disruptionStart)}`, date: t.disruptionStart });
              }
              if (t.disruptionEnd) {
                const label = t.isEstimatedEnd ? 'Expected completion' : 'Completed';
                items.push({ label: `${label}: ${formatDate(t.disruptionEnd)}`, date: t.disruptionEnd });
              }

              if (items.length === 0) return null;

              return (
                <div className="space-y-1">
                  {items.map((item, i) => (
                    <p key={i} className="text-sm text-slate-600">{item.label}</p>
                  ))}
                </div>
              );
            })()}

            {/* Disruption summary */}
            {detail.transformation.disruptionSummary && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-amber-900 mb-2">
                  What to expect
                </h3>
                <p className="text-sm text-amber-800">
                  {detail.transformation.disruptionSummary}
                </p>
              </div>
            )}

            {/* Property IDs & People (BIN, BBL, Community Board, Owner, Architect) */}
            {(() => {
              const dobNow = detail.sources?.find(s => s.dobNowDetails)?.dobNowDetails;
              const prop = detail.propertyDetails;
              const bin = prop?.bin ?? dobNow?.bin;
              const bbl = prop?.bbl;
              const owner = dobNow?.owner;
              const designProfessional = dobNow?.designProfessional;
              const communityBoard = prop?.communityBoard;

              if (!bin && !bbl && !owner && !designProfessional && !communityBoard) return null;

              // Parse CB: "402" -> borough 4, district 02
              const cbBorough = communityBoard ? parseInt(communityBoard.charAt(0), 10) : null;
              const cbDistrict = communityBoard ? parseInt(communityBoard.slice(1), 10) : null;
              const boroughNames = ['', 'Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
              const cbUrl = cbBorough && cbDistrict
                ? `https://www.nyc.gov/site/queenscb${cbDistrict}/index.page`.replace('queenscb',
                    cbBorough === 1 ? 'manhattancb' :
                    cbBorough === 2 ? 'bronxcb' :
                    cbBorough === 3 ? 'brooklyncb' :
                    cbBorough === 4 ? 'queenscb' : 'sicb')
                : null;

              return (
                <div className="text-sm text-slate-600 space-y-1">
                  {(bin || bbl) && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 flex-shrink-0">
                        <Tooltip content="BIN = Building ID Number (per building) / BBL = Borough-Block-Lot (per land parcel)" position="right">
                          <span className="text-slate-500 text-xs cursor-help border-b border-dotted border-slate-400">BIN/BBL</span>
                        </Tooltip>
                      </div>
                      <div className="flex gap-1.5 text-sm">
                        {bin && (
                          <Tooltip content="Building ID Number. Click to copy." position="top">
                            <button
                              onClick={() => navigator.clipboard.writeText(bin)}
                              className="font-mono text-slate-700 hover:text-slate-900 cursor-pointer"
                            >
                              {bin}
                            </button>
                          </Tooltip>
                        )}
                        {bin && bbl && <span className="text-slate-400">/</span>}
                        {bbl && (
                          <Tooltip content="Borough-Block-Lot. Click to copy." position="top">
                            <button
                              onClick={() => navigator.clipboard.writeText(bbl)}
                              className="font-mono text-slate-700 hover:text-slate-900 cursor-pointer"
                            >
                              {bbl}
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )}
                  {communityBoard && cbBorough && cbDistrict && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 flex-shrink-0">
                        <Tooltip content="Local advisory board that reviews land use, zoning, and neighborhood issues" position="right">
                          <span className="text-slate-500 text-xs cursor-help border-b border-dotted border-slate-400">CB</span>
                        </Tooltip>
                      </div>
                      <a
                        href={cbUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      >
                        {boroughNames[cbBorough]} CB{cbDistrict}
                      </a>
                    </div>
                  )}
                  {owner && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs w-16">Owner</span>
                      <span className="text-slate-700 text-sm">{owner}</span>
                    </div>
                  )}
                  {designProfessional && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs w-16">Architect</span>
                      <span className="text-slate-700 text-sm">{designProfessional}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Activity Feed / Sources Timeline */}
            <ActivityTimeline sources={detail.sources} formatDate={formatDate} bin={detail.propertyDetails?.bin} />
          </div>
        )}
      </div>
    </div>
  );
}
