import { Routes } from '@angular/router';
import { ResourceDownloadContainerIndexComponent } from './resource-download/index.component';
import { PreapproachDownloadContainerIndexComponent } from './pre-approach-download/index.component';

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
            component: ResourceDownloadContainerIndexComponent,
            title: "Content Library - Texts and images to share",
        },
        { path: 'prospecting-contents',
            component: PreapproachDownloadContainerIndexComponent,
            title: "Prospecting Guides - Framework and chat scripts",
        },

    ],
  },
];