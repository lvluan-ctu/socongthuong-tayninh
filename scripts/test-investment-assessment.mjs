const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3113";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => null);
  assert(
    response.status === expectedStatus,
    `${path}: expected HTTP ${expectedStatus}, received ${response.status} (${JSON.stringify(body)})`,
  );
  return body;
}

const common =
  "radiusKm=10&investmentType=INDUSTRIAL&expectedDemandKw=1500&landAreaHa=5&roofAreaM2=10000";
const assessment = await getJson(`/api/gis/investment-assessment?lat=10.555&lng=106.414&${common}`);

assert(assessment.source === "postgresql-postgis", "Assessment must expose its PostGIS source.");
assert(
  assessment.location.adminArea?.name === "Phường Long An",
  "Point must resolve to Phường Long An.",
);
assert(
  assessment.assessment.score >= 0 && assessment.assessment.score <= 100,
  "Score must be normalized.",
);
assert(assessment.scoreBreakdown.length === 7, "Seven scoring domains are required.");
assert(assessment.dataCoverage.length === 7, "Seven data-coverage domains are required.");
assert(assessment.scenarios.length === 3, "Three comparison scenarios are required.");
assert(assessment.procedures.length === 6, "Six procedure steps are required.");
assert(assessment.metrics.lines > 0, "Seeded Long An point must have nearby lines.");
assert(assessment.metrics.substations > 0, "Seeded Long An point must have nearby substations.");
assert(assessment.metrics.estimatedConnectionHeadroomKw > 0, "Grid headroom must be derived.");
assert(assessment.metrics.rooftopPotentialKwp > 0, "Rooftop scenario must be calculated.");
assert(assessment.metrics.evStations > 0, "Seeded Long An point must have EV infrastructure.");
assert(
  assessment.metrics.demandCoveragePct ===
    Math.round(
      (assessment.metrics.estimatedConnectionHeadroomKw / assessment.profile.expectedDemandKw) *
        1_000,
    ) /
      10,
  "Demand coverage must match headroom and declared demand.",
);
assert(
  assessment.scenarios[0].demandKw < assessment.scenarios[1].demandKw &&
    assessment.scenarios[1].demandKw < assessment.scenarios[2].demandKw,
  "Scenario demand must increase from conservative to growth.",
);
assert(
  assessment.assessment.disclaimer.includes("không thay thế"),
  "Assessment must retain the preliminary-screening disclaimer.",
);

const addressAssessment = await getJson(
  `/api/gis/investment-assessment?address=${encodeURIComponent("Phường Long An")}&${common}`,
);
assert(
  addressAssessment.location.adminArea?.name === "Phường Long An",
  "Local address search must resolve without changing the assessment area.",
);
assert(
  Math.abs(addressAssessment.location.lat - 10.542335) < 0.01,
  "Local PostGIS geocoding must return the seeded ward center.",
);

await getJson("/api/gis/investment-assessment?lat=10.555", 400);

const oversizedDemand = await getJson(
  "/api/gis/investment-assessment?lat=10.555&lng=106.414&radiusKm=10&investmentType=INDUSTRIAL&expectedDemandKw=100000&landAreaHa=20&roofAreaM2=50000",
);
assert(
  oversizedDemand.assessment.grade === "REVIEW_REQUIRED",
  "Demand above derived grid headroom must not be rated favorable.",
);
assert(
  oversizedDemand.assessment.decision === "SURVEY_REQUIRED",
  "A grid-capacity shortfall must require further survey.",
);

const radius5 = await getJson(
  `/api/gis/investment-assessment?lat=10.555&lng=106.414&radiusKm=5&investmentType=INDUSTRIAL&expectedDemandKw=1500&landAreaHa=5&roofAreaM2=10000`,
);
const radius20 = await getJson(
  `/api/gis/investment-assessment?lat=10.555&lng=106.414&radiusKm=20&investmentType=INDUSTRIAL&expectedDemandKw=1500&landAreaHa=5&roofAreaM2=10000`,
);
for (const metric of [
  "projects",
  "substations",
  "lines",
  "rooftopSystems",
  "evStations",
  "consumers",
]) {
  assert(
    radius20.metrics[metric] >= radius5.metrics[metric],
    `${metric} must not decrease when the search radius grows.`,
  );
}

const page = await fetch(`${baseUrl}/energy/danh-gia-dau-tu`);
const html = await page.text();
assert(page.status === 200, "Dedicated investment page must return HTTP 200.");
assert(html.includes("Đánh giá đầu tư năng lượng"), "Dedicated page must render its title.");

console.log(
  JSON.stringify(
    {
      ok: true,
      score: assessment.assessment.score,
      area: assessment.location.adminArea.name,
      maxVoltageKv: assessment.metrics.maxVoltageKv,
      headroomKw: assessment.metrics.estimatedConnectionHeadroomKw,
      evStations: assessment.metrics.evStations,
      rooftopPotentialKwp: assessment.metrics.rooftopPotentialKwp,
      checks: 27,
    },
    null,
    2,
  ),
);
