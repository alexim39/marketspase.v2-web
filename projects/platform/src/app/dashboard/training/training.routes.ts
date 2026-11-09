import { Routes } from '@angular/router';
import { AcademyDashboardComponent } from './dashboard/academy-dashboard.component';
import { TrainingLibraryComponent } from './library/training-library.component';
import { TrainingAnalyticsComponent } from './analytics/training-analytics.component';
import { TrainingListComponent } from './list/training-list.component';
import { TrainingDetailComponent } from './detail/training-detail.component';
import { TutorialsComponent } from './tutorials/tutorials.component';

export const TrainingRoutes: Routes = [
  {
    path: '',
    component: AcademyDashboardComponent,
    title: 'Leadership Academy & Development Center - Your learning journey',
  },
  {
    path: 'paths',
    redirectTo: 'courses',
    pathMatch: 'full',
  },
  {
    path: 'library',
    component: TrainingLibraryComponent,
    title: 'Training Library - Search and bookmarks',
  },
  {
    path: 'analytics',
    component: TrainingAnalyticsComponent,
    title: 'Training Analytics - Completion and pipeline',
  },
  {
    path: 'tutorials',
    component: TutorialsComponent,
    title: 'Platform Tutorials - How-to videos by app area',
  },
  {
    path: 'courses',
    children: [
      {
        path: '',
        component: TrainingListComponent,
        title: 'Courses - IPO, QSG, SMO and Leadership',
      },
      {
        path: ':courseId',
        component: TrainingDetailComponent,
        title: 'Course - Lessons and certification',
      },
    ],
  },
  {
    path: ':courseId',
    redirectTo: 'courses/:courseId',
    pathMatch: 'full',
  },
];
