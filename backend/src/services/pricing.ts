export type Vehicle = "BERLINE" | "VAN" | "ELECTRIC";

type VehiclePricing = {
  minimumFareCents: number;
  commissionBasisPoints: number;
  baseFareCents: number;
  perKmCents: number;
  perMinuteCents: number;
};

const PRICING: Record<Vehicle, VehiclePricing> = {
  BERLINE: { minimumFareCents: 1000, commissionBasisPoints: 1500, baseFareCents: 300, perKmCents: 150, perMinuteCents: 30 },
  VAN: { minimumFareCents: 1000, commissionBasisPoints: 1500, baseFareCents: 600, perKmCents: 220, perMinuteCents: 40 },
  ELECTRIC: { minimumFareCents: 1000, commissionBasisPoints: 1500, baseFareCents: 400, perKmCents: 160, perMinuteCents: 30 }
};

export function calculateQuote(input: {
  vehicle: Vehicle;
  distanceKm: number;
  durationMinutes: number;
  fixedFareEuros?: number;
}) {
  const c = PRICING[input.vehicle];
  const rawCents = input.fixedFareEuros !== undefined
    ? Math.round(input.fixedFareEuros * 100)
    : Math.round(c.baseFareCents + input.distanceKm * c.perKmCents + input.durationMinutes * c.perMinuteCents);

  const customerFareCents = Math.max(c.minimumFareCents, rawCents);
  const commissionCents = Math.round(customerFareCents * c.commissionBasisPoints / 10_000);
  const driverShareCents = customerFareCents - commissionCents;

  return {
    currency: "EUR",
    customerFare: (customerFareCents / 100).toFixed(2),
    platformCommission: (commissionCents / 100).toFixed(2),
    driverEarnings: (driverShareCents / 100).toFixed(2),
    commissionRate: 0.15,
    minimumFare: "10.00",
    pricingMode: input.fixedFareEuros !== undefined ? "FIXED" : "DISTANCE_TIME",
    disclaimer: "Tarifs de démonstration à valider commercialement et juridiquement."
  };
}
