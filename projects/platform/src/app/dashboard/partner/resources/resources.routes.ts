import { Routes } from '@angular/router';
import { ResourceDownloadContainerComponent } from './resource-download/resource-download-container.component';
import { PreapproachDownloadContainerComponent } from './pre-approach-download/pre-approach-download-container.component';

export const ResourcesRoutes: Routes = [
  {
    path: '',
    redirectTo: 'ads-contents',
    pathMatch: 'full',
  },
  {
    path: '',
    children: [
        { path: 'ads-contents',
            component: ResourceDownloadContainerComponent,
            title: "Content Library - Texts and images to share",
        },
        { path: 'prospecting-contents',
            component: PreapproachDownloadContainerComponent,
            title: "Prospecting Guides - Framework and chat scripts",
        },

    ],
  },
];