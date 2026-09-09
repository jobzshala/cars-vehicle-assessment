import { useState, type ChangeEvent, type FormEvent } from "react";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import type { NewCarInput } from "../types";

interface AddCarFormProps {
  onSubmit: (input: NewCarInput) => Promise<void> | void;
  submitting?: boolean;
  error?: string;
}

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#e0e0e0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#757575">No image</text></svg>',
  );

const CURRENT_YEAR = new Date().getFullYear();

const emptyForm = { make: "", model: "", year: "", color: "", imageUrl: "" };

export function AddCarForm({ onSubmit, submitting = false, error }: AddCarFormProps) {
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  const yearNumber = Number(form.year);
  const errors = {
    make: form.make.trim() === "" ? "Make is required" : "",
    model: form.model.trim() === "" ? "Model is required" : "",
    year:
      form.year === "" || !Number.isInteger(yearNumber)
        ? "Year is required"
        : yearNumber < 1886 || yearNumber > CURRENT_YEAR + 1
          ? `Year must be between 1886 and ${CURRENT_YEAR + 1}`
          : "",
    color: form.color.trim() === "" ? "Color is required" : "",
  };
  const isValid = Object.values(errors).every((message) => message === "");

  const update = (field: keyof typeof emptyForm) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    const imageUrl = form.imageUrl.trim() || PLACEHOLDER_IMAGE;
    await onSubmit({
      make: form.make.trim(),
      model: form.model.trim(),
      year: yearNumber,
      color: form.color.trim(),
      mobile: imageUrl,
      tablet: imageUrl,
      desktop: imageUrl,
    });
    setForm(emptyForm);
    setTouched(false);
  };

  const showError = (field: keyof typeof errors) => touched && errors[field] !== "";

  return (
    <Paper component="form" onSubmit={handleSubmit} noValidate sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        Add a car
      </Typography>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Make"
            value={form.make}
            onChange={update("make")}
            error={showError("make")}
            helperText={showError("make") ? errors.make : " "}
            required
            fullWidth
          />
          <TextField
            label="Model"
            value={form.model}
            onChange={update("model")}
            error={showError("model")}
            helperText={showError("model") ? errors.model : " "}
            required
            fullWidth
          />
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            label="Year"
            type="number"
            value={form.year}
            onChange={update("year")}
            error={showError("year")}
            helperText={showError("year") ? errors.year : " "}
            required
            fullWidth
          />
          <TextField
            label="Color"
            value={form.color}
            onChange={update("color")}
            error={showError("color")}
            helperText={showError("color") ? errors.color : " "}
            required
            fullWidth
          />
        </Stack>
        <TextField
          label="Image URL (optional)"
          value={form.imageUrl}
          onChange={update("imageUrl")}
          helperText="Used for all screen sizes; a placeholder is shown if empty"
          fullWidth
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          sx={{ alignSelf: "flex-start" }}
        >
          {submitting ? "Adding…" : "Add car"}
        </Button>
      </Stack>
    </Paper>
  );
}
