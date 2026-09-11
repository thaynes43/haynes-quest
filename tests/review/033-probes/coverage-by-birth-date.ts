// WO-033 probe R-1: save creation is refused by BIRTH date, not by the photos' capture dates.
import { createAdventurePlan } from "../../../src/shared/adventure";
import { wholeYearsAt } from "../../../src/server/domain";

function attempt(label: string, birth: string, dates: string[]): void {
  const memories = dates.map((date, index) => ({
    id: `m${index}`,
    date,
    ageYears: wholeYearsAt(birth, date),
  }));
  try {
    const plan = createAdventurePlan(birth, memories);
    const levels = plan.levels.map(
      (level) =>
        `${level.startDate}/${level.periodId}/${level.routeId}/ages ${level.startAgeYears}->${level.targetAgeYears}`,
    );
    console.log(`OK    ${label}\n      ${levels.join(" | ")}`);
  } catch (error) {
    console.log(`FAIL  ${label}\n      ${(error as Error).name}`);
  }
}

// A six-year-old on 2026-09-11 was born between 2019-09-12 and 2020-09-11.
const photos = ["2024-03-01", "2025-03-01", "2026-03-01"];
attempt("born 2019-10-01 (six today), photos all inside the curated 2024-2026 window", "2019-10-01", photos);
attempt("born 2020-03-01 (six today), the same photos", "2020-03-01", photos);
attempt("born 2016-05-01 (ten today), photos 2021-05-01 and 2024-05-01", "2016-05-01", ["2021-05-01", "2024-05-01"]);
attempt("born 2020-01-01, a 2027-01-05 photo becomes a level start date", "2020-01-01", [
  "2027-01-05",
  "2028-01-05",
]);
attempt("born 2020-01-01, a 2027-01-05 photo is only the final memory", "2020-01-01", [
  "2024-06-01",
  "2027-01-05",
]);
