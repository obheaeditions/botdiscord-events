// Resolve stored image/document paths (relative, e.g. "/uploads/xxx.jpg") into absolute
// publicly reachable URLs, using BACKEND_URL. Paths already absolute (http...) are left untouched.
export function resolveImageUrls(images, backendUrl) {
  return images.map(img => img.startsWith('http') ? img : `${backendUrl}${img}`);
}
