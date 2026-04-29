import { z } from "zod";

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const RegisterSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(50, "Username must be 50 characters or fewer."),
  })
  .superRefine((values, context) => {
    if (values.password !== values.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const CreateLeagueSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "League name is required.")
    .max(50, "League name must be 50 characters or fewer."),
  sport_ids: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one sport."),
  budget: z.coerce
    .number()
    .int("Budget must be a whole number.")
    .positive("Budget must be greater than zero."),
  squad_size: z.coerce
    .number()
    .int("Squad size must be a whole number.")
    .min(2, "Squad size must be at least 2.")
    .max(64, "Squad size must be 64 or fewer."),
  draft_mode: z.boolean(),
  is_public: z.boolean(),
});

export const JoinLeagueSchema = z.object({
  invite_code: z
    .string()
    .trim()
    .min(1, "Invite code is required.")
    .max(64, "Invite code is too long."),
});

export const CreateTeamSchema = z.object({
  player_ids: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one player."),
  team_name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(30, "Team name must be 30 characters or fewer."),
});

export type LoginValues = z.infer<typeof LoginSchema>;
export type RegisterValues = z.infer<typeof RegisterSchema>;
export type CreateLeagueValues = z.infer<typeof CreateLeagueSchema>;
export type JoinLeagueValues = z.infer<typeof JoinLeagueSchema>;
export type CreateTeamValues = z.infer<typeof CreateTeamSchema>;
