/*
 * File: UserAvatar.tsx                                                                  *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { UserCircle } from 'lucide-react';

export type UserAvatarSize = 'sm' | 'lg';

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  sm: 'w-9 h-9',
  lg: 'w-14 h-14',
};

const INITIALS_TEXT_CLASSES: Record<UserAvatarSize, string> = {
  sm: 'text-xs',
  lg: 'text-lg',
};

const ICON_SIZE_CLASSES: Record<UserAvatarSize, string> = {
  sm: 'w-4 h-4',
  lg: 'w-7 h-7',
};

interface UserAvatarProps {
  username?: string; // assente = nessuno loggato: icona omino
  size?: UserAvatarSize;
  onClick?: () => void; // se presente, diventa un bottone (es. apre pagina Account)
  label?: string; // aria-label del bottone, richiesta se onClick è presente
}

// Tondo circolare con iniziali utente e sfondo gradiente del navigatore
export function UserAvatar({ username, size = 'sm', onClick, label }: UserAvatarProps) {
  const content = username ? (
    <span className={`font-display font-bold text-white ${INITIALS_TEXT_CLASSES[size]}`}>
      {username.slice(0, 2).toUpperCase()}
    </span>
  ) : (
    <UserCircle className={`text-white ${ICON_SIZE_CLASSES[size]}`} />
  );

  const className = `${SIZE_CLASSES[size]} rounded-full gradient-aurora shadow-glow flex items-center justify-center flex-shrink-0`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={`${className} transition-all duration-200 active:scale-90`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
