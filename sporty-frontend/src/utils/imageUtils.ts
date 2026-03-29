export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function toObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
