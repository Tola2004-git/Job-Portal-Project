export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const dataUrlToBytes = (dataUrl) => {
  if (typeof dataUrl !== 'string') return 0;
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index === -1) return 0;
  const base64 = dataUrl.slice(base64Index + 7);
  return Math.ceil((base64.length * 3) / 4);
};

export const compressImageFile = async (
  file,
  {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.85,
    maxSizeMB = 0.7,
    outputType = 'image/jpeg',
  } = {}
) => {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selected file is not an image.');
  }

  const originalDataUrl = await readFileAsDataURL(file);
  const image = await loadImage(originalDataUrl);

  let targetWidth = image.width;
  let targetHeight = image.height;

  if (targetWidth > maxWidth || targetHeight > maxHeight) {
    const widthRatio = maxWidth / targetWidth;
    const heightRatio = maxHeight / targetHeight;
    const ratio = Math.min(widthRatio, heightRatio);
    targetWidth = Math.max(1, Math.round(targetWidth * ratio));
    targetHeight = Math.max(1, Math.round(targetHeight * ratio));
  }

  // If no resizing needed and original already below size limit, return as-is
  const originalBytes = dataUrlToBytes(originalDataUrl);
  if (originalBytes <= maxSizeMB * 1024 * 1024 && targetWidth === image.width && targetHeight === image.height) {
    return originalDataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return originalDataUrl;
  }

  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  let currentQuality = Math.min(Math.max(quality, 0.2), 0.95);
  let result = canvas.toDataURL(outputType, currentQuality);
  let resultBytes = dataUrlToBytes(result);

  while (resultBytes > maxSizeMB * 1024 * 1024 && currentQuality > 0.2) {
    currentQuality = Math.max(0.2, currentQuality - 0.1);
    result = canvas.toDataURL(outputType, currentQuality);
    resultBytes = dataUrlToBytes(result);
  }

  return result;
};
