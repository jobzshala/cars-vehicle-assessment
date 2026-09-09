# Cars — Frontend Assessment

React 19 + TypeScript + Vite app that lists cars from a mock GraphQL API (MSW),
shows a screen-size-appropriate image per car, lets you add cars, and supports
search, sort and year filtering.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test       # unit tests (Vitest + Testing Library)
npm run lint
npm run build
```

Requires Node 20+ and npm.

## What's implemented

| Requirement | Where |
| --- | --- |
| Apollo Client + `GetCars` query | `src/App.tsx`, `src/graphql/queries.ts` |
| GraphQL logic in a custom hook | `src/hooks/useCars.ts` |
| Responsive image (mobile ≤640 / tablet 641–1023 / desktop ≥1024) | `src/hooks/useDeviceType.ts`, `src/components/CarCard.tsx` |
| Material UI cards | `src/components/CarCard.tsx`, `CarList.tsx` |
| Add-car form stored in local state | `src/components/AddCarForm.tsx`, `CarsPage.tsx` |
| Mocked API call for car creation | `CreateCar` mutation in `src/mocks/handlers.ts`, `src/hooks/useCreateCar.ts` |
| Search by model + sorting | `src/hooks/useCarFilters.ts`, `src/components/CarFilters.tsx` |
| Unit tests | `*.test.ts(x)` next to each module |
| **Extra:** single-car query by make/model/year/color | `GetCar` in `handlers.ts`, `src/hooks/useCar.ts` |
| **Extra:** year filter (multi-filtering) | `useCarFilters.ts`, `CarFilters.tsx` |
| **Extra:** reusable `useCarFilters()` hook | `src/hooks/useCarFilters.ts` |

## Structure

```
src/
  App.tsx                 Apollo provider + MUI baseline
  types.ts                Car / NewCarInput types
  graphql/queries.ts      CarFields fragment, GetCars, GetCar, CreateCar
  hooks/
    useCars.ts            GetCars -> { cars, loading, error, refetch }
    useCar.ts             GetCar by criteria (skipped when no criteria)
    useCreateCar.ts       CreateCar mutation wrapper
    useCarFilters.ts      search / sort / year state + pure filterCars & sortCars
    useDeviceType.ts      mobile | tablet | desktop via matchMedia
  components/
    CarsPage.tsx          composes form, filters and list; holds added-car state
    AddCarForm.tsx        validated MUI form
    CarFilters.tsx        search box, sort select, year select
    CarList.tsx           loading / error / empty / grid states
    CarCard.tsx           MUI card, picks image by device type
  mocks/                  MSW browser worker + GraphQL handlers
  test/                   Vitest setup and fixtures
```

## Design notes

- **Filtering is pure.** `filterCars` and `sortCars` are plain functions so they
  are trivially testable; `useCarFilters` just wires them to React state.
- **Breakpoints are explicit pixel queries** (not MUI's theme breakpoints) because
  the spec defines 640/1023 boundaries, which don't match MUI's defaults.
- **Added cars live in local state** as the spec asks. The mocked `CreateCar`
  mutation returns a server-generated id after a 500 ms delay so the loading
  state is visible; the result is then appended to local state rather than
  written to the Apollo cache.
- **`__typename` in mocks.** Queries use a `CarFields` fragment, and Apollo can
  only match a fragment on `Car` if the response includes `__typename: "Car"`,
  so the MSW handlers add it — as a real GraphQL server would.
- **Tests avoid `matchMedia` in most places.** jsdom has no `matchMedia`, so MUI's
  `useMediaQuery` falls back to `false` (desktop). `useDeviceType` is tested
  directly with a stubbed `matchMedia`, and `CarCard` mocks the hook.

## Changes to the starter

- Added `@emotion/react` / `@emotion/styled` (required MUI peers).
- Added Vitest + Testing Library; ESLint 9 flat config (`eslint.config.js`) —
  the starter shipped ESLint 9 with no config file.
- Pinned `jsdom@25` — v30 requires Node 22.
- Removed the unused Vite template CSS and the instructions placeholder component.
