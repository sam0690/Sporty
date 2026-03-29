import { sanitizeText } from "@/libs/sanitize";

interface SanitizedTextProps {
    value: string;
}

export default function SanitizedText({ value }: SanitizedTextProps) {
    return <>{sanitizeText(value)}</>;
}
