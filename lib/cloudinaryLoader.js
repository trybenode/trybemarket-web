export default function cloudinaryLoader({ src, width, quality }) {
  return `https://res.cloudinary.com/dj21x4jnt/image/upload/f_auto,q_auto,w_${width}/${src}`;
}