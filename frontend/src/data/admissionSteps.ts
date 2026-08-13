import type { AdmissionStep } from '@/types/content'

export const admissionSteps: AdmissionStep[] = [
  {
    title: 'Submit Application',
    description:
      'Complete the application form online or at the school office and submit the required documents.',
  },
  {
    title: 'Application Review',
    description:
      'Our admissions team reviews your application and confirms eligibility for the class applied to.',
  },
  {
    title: 'Assessment / Interview',
    description:
      'Your child attends a friendly assessment or interview to help us understand their learning needs.',
  },
  {
    title: 'Admission Decision',
    description:
      'Successful applicants receive an offer letter together with the next steps for enrolment.',
  },
  {
    title: 'Enrollment',
    description:
      'Complete enrolment, confirm fees as applicable, and welcome your child to the PRPS family.',
  },
]
