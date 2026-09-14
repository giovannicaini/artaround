/*
 * File: /src/pages/NotFoundPage.tsx                                                     *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
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

import { useNavigate } from 'react-router-dom';
import type { NavigatorConfig } from '@artaround/shared';
import { useT } from '../services/useT';
import { EmptyState, Button } from '../components/ui';

interface NotFoundPageProps {
  config?: NavigatorConfig;
}

// Rotta non riconosciuta: pagina 404
export default function NotFoundPage({ config }: NotFoundPageProps) {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="h-full flex flex-col items-center justify-center bg-surface-950 px-6">
      {config?.branding.logo && (
        <img
          src={config.branding.logo}
          alt=""
          className="w-16 h-16 rounded-2xl object-cover mb-6 shadow-glow"
        />
      )}
      <EmptyState
        title={t('Pagina non trovata')}
        message={t('Il link che hai seguito non esiste più o è cambiato indirizzo.')}
        action={
          <Button variant="primary" onClick={() => navigate('/')}>
            {t('Torna alla Home')}
          </Button>
        }
      />
    </div>
  );
}
