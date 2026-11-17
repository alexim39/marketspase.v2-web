import { Routes } from '@angular/router';
import { AcademyDashboardIndexComponent } from './dashboard/index.component';
import { TrainingAnalyticsIndexComponent } from './analytics/index.component';
import { TrainingListIndexComponent } from './list/index.component';
import { TrainingDetailIndexComponent } from './detail/index.component';
import { TutorialsIndexComponent } from './tutorials/index.component';

export const TrainingRoutes: Routes = [
  {
    path: '',
    component: AcademyDashboardIndexComponent,
    title: 'Leadership Academy & Development Center - Your learning journey',
  },
  {
    path: 'paths',
    redirectTo: 'courses',
    pathMatch: 'full',
  },
  {
    path: 'library',
    redirectTo: 'courses',
    pathMatch: 'full',
  },
  {
    path: 'analytics',
    component: TrainingAnalyticsIndexComponent,
    title: 'Training Analytics - Completion and pipeline',
  },
  {
    path: 'tutorials',
    component: TutorialsIndexComponent,
    title: 'Platform Tutorials - How-to videos by app area',
  },
  {
    path: 'courses',
    children: [
      {
        path: '',
        component: TrainingListIndexComponent,
        title: 'Courses - IPO, QSG, SMO and Leadership',
      },
      {
        path: ':courseId/lessons/:lessonId',
        component: TrainingDetailIndexComponent,
        title: 'Lesson - Watch, learn and complete',
      },
      {
        path: ':courseId',
        component: TrainingDetailIndexComponent,
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
