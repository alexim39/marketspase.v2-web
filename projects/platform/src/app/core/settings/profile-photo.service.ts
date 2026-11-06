import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';

export interface PhotoUploadResponse {
  message: string;
  success: boolean;
  data?: { url: string };
}

/** Profile photo upload → backend `/v1/settings/profile-image` (Cloudinary). Fully typed. */
@Injectable({ providedIn: 'root' })
export class ProfilePhotoService {
  private readonly api = inject(ApiClient);

  upload(file: File): Observable<PhotoUploadResponse> {
    const form = new FormData();
    form.append('image', file, file.name);
    return this.api.upload<PhotoUploadResponse>('v1/settings/profile-image', form);
  }
}
