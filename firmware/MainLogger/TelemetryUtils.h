#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

// Only these exact filenames are eligible for automatic deletion.
inline bool parseOwnedName(const char *name, uint32_t &id) {
  if (!name || strlen(name) < 15 || name[0] != 'q' || name[11] != '.') return false;
  const char *ext = name + 12;
  if (strcmp(ext, "log") && strcmp(ext, "jpg") && strcmp(ext, "part")) return false;
  uint64_t n = 0;
  for (int i=1; i<=10; ++i) {
    if (name[i] < '0' || name[i] > '9') return false;
    n = n*10 + (name[i]-'0');
  }
  if (n == 0 || n > UINT32_MAX) return false;
  id = uint32_t(n); return true;
}
inline float decodeTMP102(uint16_t raw, bool extended) {
  int32_t count = extended ? (raw >> 3) : (raw >> 4);
  int32_t sign = extended ? 0x1000 : 0x0800;
  if (count & sign) count -= extended ? 8192 : 4096;
  return count * 0.0625f;
}
inline uint32_t crc32Update(uint32_t crc, uint8_t b) {
  crc ^= b;
  for (int j=0; j<8; ++j) crc = (crc >> 1) ^ ((crc & 1) ? 0xEDB88320UL : 0);
  return crc;
}
inline bool storageFits(uint64_t owned, uint64_t incoming, uint64_t budget,
                        uint64_t free, uint64_t reserve) {
  return incoming <= budget && owned <= budget-incoming &&
         incoming <= free && reserve <= free-incoming;
}
