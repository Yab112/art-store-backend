import * as fs from "fs";
import * as path from "path";

export interface FileInfo {
  name: string;
  size: number;
  type: string;
}

export const getFileExtension = (filename: string): string => {
  return path.extname(filename).toLowerCase();
};

export const isValidFileType = (
  filename: string,
  allowedTypes: string[],
): boolean => {
  const extension = getFileExtension(filename);
  return allowedTypes.includes(extension);
};

export const getFileSize = (filePath: string): number => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
};

export const createDirectoryIfNotExists = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
