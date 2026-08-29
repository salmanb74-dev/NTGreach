export function initialsFromName(name: string, max = 2): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, max)
}
