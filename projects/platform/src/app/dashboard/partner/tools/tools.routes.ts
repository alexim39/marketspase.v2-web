import { Routes } from '@angular/router';
import { smsContainerComponent } from '../sms/sms-container.component';
import { smsLogContainerComponent } from '../sms/sms-log/sms-log-container.component';
import { EmailContainerComponent } from '../email/email-container.component';
import { EmailLogContainerComponent } from '../email/email-log/email-log-container.component';
import { CreateContactsContainerComponent } from '../contacts/create/create-contacts-container.component';


export const ToolsRoutes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard/promote/outreach',
    pathMatch: 'full',
  },
  {
    path: '',
        children: [
    ],
  },
  {
    path: 'sms',
        children: [
            {
                path: 'new',
                component: smsContainerComponent,
                title: "Send SMS - Send bulk SMS to one or more contacts",
            },
            {
                path: 'messages',
                component: smsLogContainerComponent,
                title: "SMS Inbox - View and manage your bulk SMS messages ",
            },   
        ]
   },
  {
    path: 'email',
        children: [
            {
                path: 'new',
                component: EmailContainerComponent,
                title: "Send Email - Send bulk email to one or more contacts",
            },  
            {
                path: 'logs',
                component: EmailLogContainerComponent,
                title: "Email Inbox - View and manage your bulk email messages ",
            },    
        ]
   },
  {
    path: 'contacts',
        children: [
             {
                path: 'new',
                component: CreateContactsContainerComponent,
                title: "Create Contacts - Create new contacts",
            },   
        ]
   },
];

  