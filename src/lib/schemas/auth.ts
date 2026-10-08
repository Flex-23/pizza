import { z } from "zod";

import { findStreet } from "@/lib/data/streets";
import {
  emailSchema,
  idSchema,
  optionalText,
  phoneSchema,
} from "@/lib/schemas/common";

export const passwordSchema = z
  .string()
  .min(1, "Passwort erforderlich")
  .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein")
  .max(72, "Passwort ist zu lang");

const nameSchema = z.string().trim().min(2, "Name erforderlich").max(120);

/**
 * A manager account as the owner creates it: an address and a password, and
 * nothing else. The display name is derived from the address by the action.
 */
export const managerCreateSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type ManagerCreateInput = z.infer<typeof managerCreateSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Passwort erforderlich").max(72),
});

/**
 * Sign-up asks for the delivery address as two pieces: a street name the
 * customer *picks from the dataset* and the house number they type. The postal
 * code, city and district are never sent by the browser — the action derives
 * them from the chosen street, so a tampered request cannot mismatch them.
 *
 * Every field is mandatory: an account without a deliverable address is of no
 * use to the kitchen, and asking once at sign-up saves the customer from typing
 * it again at checkout.
 */
export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    streetName: z.string().trim().min(1, "Straßenname erforderlich").max(180),
    houseNumber: z.string().trim().min(1, "Hausnummer erforderlich").max(20),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Bitte bestätigen Sie das Passwort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  })
  // The strict-list constraint: the street must exist in the dataset. Enforced
  // here so the browser can never be the only thing standing between a bogus
  // street and the database.
  .refine((data) => findStreet(data.streetName) !== undefined, {
    message: "Bitte wählen Sie eine Straße aus der Liste",
    path: ["streetName"],
  });

export const profileUpdateSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

/**
 * The saved-address form (profile → addresses) uses the same street picker as
 * sign-up: a street chosen from the dataset plus a typed house number. The
 * postal code, city and district are derived server-side from the street.
 */
export const addressSchema = z
  .object({
    label: optionalText(60),
    streetName: z.string().trim().min(1, "Straßenname erforderlich").max(180),
    houseNumber: z.string().trim().min(1, "Hausnummer erforderlich").max(20),
    notes: optionalText(255),
    isDefault: z.coerce.boolean().default(false),
  })
  .refine((data) => findStreet(data.streetName) !== undefined, {
    message: "Bitte wählen Sie eine Straße aus der Liste",
    path: ["streetName"],
  });

export const addressUpdateSchema = z.object({
  id: idSchema,
  data: addressSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeInput = z.input<typeof passwordChangeSchema>;
export type AddressValues = z.input<typeof addressSchema>;
export type AddressInput = z.output<typeof addressSchema>;

export type AddressView = {
  id: string;
  label: string | null;
  street: string;
  postalCode: string;
  city: string;
  district: string | null;
  notes: string | null;
  isDefault: boolean;
};
