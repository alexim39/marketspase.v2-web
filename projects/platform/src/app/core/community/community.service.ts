import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import {
  AttachmentEnvelope, CommentEnvelope, CommentsEnvelope, CreatePostPayload, DirectoryEnvelope,
  FeedEnvelope, PostEnvelope, ToggleEnvelope, UpdatePostPayload,
} from './community.models';

/** Community feed → backend `/v1/community/*`. Fully typed. */
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly api = inject(ApiClient);

  feed(before?: string, limit = 20): Observable<FeedEnvelope> {
    const query = new URLSearchParams({ limit: String(limit), ...(before ? { before } : {}) });
    return this.api.get<FeedEnvelope>(`v1/community/feed?${query.toString()}`);
  }

  create(payload: CreatePostPayload): Observable<PostEnvelope> {
    return this.api.post<PostEnvelope>('v1/community', payload);
  }

  update(postId: string, payload: UpdatePostPayload): Observable<PostEnvelope> {
    return this.api.put<PostEnvelope>(`v1/community/${postId}`, payload);
  }

  remove(postId: string): Observable<unknown> {
    return this.api.delete(`v1/community/${postId}`);
  }

  /** Upload one photo or video; returns the attachment ref for the composer. */
  uploadMedia(file: File): Observable<AttachmentEnvelope> {
    const form = new FormData();
    form.append('media', file, file.name);
    return this.api.upload<AttachmentEnvelope>('v1/community/attachments', form);
  }

  toggleLike(postId: string): Observable<ToggleEnvelope> {
    return this.api.post<ToggleEnvelope>(`v1/community/${postId}/like`, {});
  }

  toggleCommentLike(commentId: string): Observable<ToggleEnvelope> {
    return this.api.post<ToggleEnvelope>(`v1/community/comments/${commentId}/like`, {});
  }

  directory(query: string): Observable<DirectoryEnvelope> {
    const params = new URLSearchParams({ q: query });
    return this.api.get<DirectoryEnvelope>(`v1/community/directory?${params.toString()}`);
  }

  comments(postId: string): Observable<CommentsEnvelope> {
    return this.api.get<CommentsEnvelope>(`v1/community/${postId}/comments`);
  }

  addComment(postId: string, body: string, parentId?: string): Observable<CommentEnvelope> {
    return this.api.post<CommentEnvelope>(`v1/community/${postId}/comments`, {
      body,
      ...(parentId ? { parentId } : {}),
    });
  }

  toggleSave(postId: string): Observable<PostEnvelope> {
    return this.api.post<PostEnvelope>(`v1/community/${postId}/save`, {});
  }

  /** Pin/unpin to top (announcements + events; 3-pin cap server-enforced). */
  pin(postId: string, pinned: boolean): Observable<PostEnvelope> {
    return this.api.post<PostEnvelope>(`v1/community/${postId}/pin`, { pinned });
  }

  report(postId: string, reason = ''): Observable<unknown> {
    return this.api.post(`v1/community/${postId}/report`, { reason });
  }
}
