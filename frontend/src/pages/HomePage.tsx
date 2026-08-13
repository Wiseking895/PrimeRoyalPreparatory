import { AcademicPrograms } from '@/sections/home/AcademicPrograms'
import { AdmissionProcess } from '@/sections/home/AdmissionProcess'
import { ContactSection } from '@/sections/home/ContactSection'
import { CtaBanner } from '@/sections/home/CtaBanner'
import { Features } from '@/sections/home/Features'
import { GallerySection } from '@/sections/home/GallerySection'
import { Hero } from '@/sections/home/Hero'
import { NewsEvents } from '@/sections/home/NewsEvents'
import { ParentPortal } from '@/sections/home/ParentPortal'
import { Statistics } from '@/sections/home/Statistics'

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <Statistics />
      <AcademicPrograms />
      <AdmissionProcess />
      <ParentPortal />
      <NewsEvents />
      <GallerySection />
      <ContactSection />
      <CtaBanner />
    </>
  )
}
