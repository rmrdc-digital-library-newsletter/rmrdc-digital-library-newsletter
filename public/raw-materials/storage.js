const STORAGE_KEY = "rmrdc_uploaded_minerals";
const IMAGE_LIBRARY_KEY = "rmrdc_local_image_library";

function getUploadedMinerals() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveUploadedMinerals(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getAllMinerals() {
  return [...minerals, ...getUploadedMinerals()];
}

function getLocalImages() {
  try {
    return JSON.parse(localStorage.getItem(IMAGE_LIBRARY_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveLocalImages(items) {
  localStorage.setItem(IMAGE_LIBRARY_KEY, JSON.stringify(items));
}

function addLocalImage(image) {
  const images = getLocalImages();
  images.unshift(image);
  saveLocalImages(images);
  return image;
}

function removeLocalImage(id) {
  const images = getLocalImages().filter(img => img.id !== id);
  saveLocalImages(images);
}

function createSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function splitItems(text) {
  return text
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}
