/*
 * File: /src/models/index.ts                                                            *
 * Project: @artaround/server                                                            *
 * Last Modified: 08/09/2026                                                             *
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

/**
 * Barrel: ri-esporta tutti i model Mongoose dell'app.
 */
export { User } from './User.js';
export type { UserDocument } from './User.js';
export { MuseumModel } from './Museum.js';
export type { MuseumDocument } from './Museum.js';
export { ArtworkModel } from './Artwork.js';
export type { ArtworkDocument } from './Artwork.js';
export { ItemModel } from './Item.js';
export type { ItemDocument } from './Item.js';
export { VisitModel } from './Visit.js';
export type { VisitDocument } from './Visit.js';
export { VisitPurchase } from './VisitPurchase.js';
export type { VisitPurchaseDocument } from './VisitPurchase.js';
export { ItemPurchase } from './ItemPurchase.js';
export type { ItemPurchaseDocument } from './ItemPurchase.js';
export { CreditTransaction } from './CreditTransaction.js';
export type { CreditTransactionDocument } from './CreditTransaction.js';
export { MuseumRoleRequestModel } from './MuseumRoleRequest.js';
export type { MuseumRoleRequestDocument } from './MuseumRoleRequest.js';
export { NavigatorConfigModel } from './NavigatorConfig.js';
export type { NavigatorConfigDocument } from './NavigatorConfig.js';
export { JobModel } from './Job.js';
export type { IJob, JobType, JobStatus, JobProgress } from './Job.js';
export { NotificationModel } from './Notification.js';
export type { INotification, NotificationKind } from './Notification.js';
