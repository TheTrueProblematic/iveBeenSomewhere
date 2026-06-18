import React from 'react';
import { profileImageUrl } from '../profileImages';

// Renders a user's avatar: either a chosen preset profile image, or the
// monogram fallback (first letter of the name on a brass plate).
// `className` controls the box size/shape; pass it whatever sizing utilities
// you'd give the surrounding element (e.g. "h-8 w-8 rounded-sm").
export default function Avatar({ name, profileImage, className = '', letterClassName = '' }) {
  const url = profileImageUrl(profileImage);
  const letter = (name || '?').charAt(0).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <span
      className={`grid place-items-center bg-brass-gradient font-display font-bold text-ink ${className} ${letterClassName}`}
    >
      {letter}
    </span>
  );
}
