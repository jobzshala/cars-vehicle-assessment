import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import {
  SORT_OPTIONS,
  type SortOption,
  type YearFilter,
} from "../hooks/useCarFilters";

interface CarFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  year: YearFilter;
  onYearChange: (value: YearFilter) => void;
  availableYears: number[];
}

export function CarFilters({
  search,
  onSearchChange,
  sort,
  onSortChange,
  year,
  onYearChange,
  availableYears,
}: CarFiltersProps) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
      <TextField
        label="Search by model"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        fullWidth
      />
      <TextField
        select
        label="Sort by"
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        sx={{ minWidth: 180 }}
      >
        {SORT_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Year"
        value={year}
        onChange={(e) => {
          const value = e.target.value;
          onYearChange(value === "all" ? "all" : Number(value));
        }}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="all">All years</MenuItem>
        {availableYears.map((y) => (
          <MenuItem key={y} value={y}>
            {y}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
