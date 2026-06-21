import "dotenv/config";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import crypto from "crypto";

const INSTRUCTORS = [
  { name: "Dr. Amara Okonkwo", title: "Full Stack Developer & Educator", bio: "<p>Dr. Amara Okonkwo is a seasoned software engineer with over 12 years of experience building scalable web applications. She holds a PhD in Computer Science from the University of Lagos and has worked with Fortune 500 companies across Africa and Europe. Her teaching philosophy centers on practical, project-based learning.</p>", gender: "women", img: 1 },
  { name: "Chukwuemeka Eze", title: "Data Science & Machine Learning Expert", bio: "<p>Chukwuemeka is a data scientist with deep expertise in Python, TensorFlow, and statistical modelling. He previously led analytics teams at two Nigerian fintech unicorns and now dedicates his career to mentoring the next generation of African data scientists.</p>", gender: "men", img: 2 },
  { name: "Fatima Al-Hassan", title: "UI/UX Designer & Product Strategist", bio: "<p>Fatima brings 9 years of design experience spanning mobile apps, enterprise software, and e-commerce platforms. She has delivered products used by millions of users across West Africa and the Middle East. Her courses blend design theory with hands-on Figma workshops.</p>", gender: "women", img: 3 },
  { name: "Oluwaseun Adeyemi", title: "Cloud Architect & DevOps Engineer", bio: "<p>Oluwaseun is an AWS-certified solutions architect with a passion for infrastructure automation. He has led cloud migrations for banks and telecom companies across Nigeria, Ghana, and Kenya. He specialises in Terraform, Kubernetes, and CI/CD pipelines.</p>", gender: "men", img: 4 },
  { name: "Ngozi Chukwu", title: "Cybersecurity Analyst & Ethical Hacker", bio: "<p>Ngozi is a certified ethical hacker (CEH) and CISSP professional with 10 years in the security field. She has conducted penetration tests for government agencies and major financial institutions, and is an advocate for building security-first engineering culture.</p>", gender: "women", img: 5 },
  { name: "Emmanuel Owusu", title: "Mobile Developer — iOS & Android", bio: "<p>Emmanuel is a cross-platform mobile developer specialising in Flutter and React Native. He has shipped over 20 apps on both the App Store and Play Store, including several with 100,000+ downloads. He teaches through real-world app builds from scratch.</p>", gender: "men", img: 6 },
  { name: "Aisha Bello", title: "Digital Marketing & Growth Strategist", bio: "<p>Aisha has helped over 50 brands across Africa scale their online presence through data-driven marketing. With certifications from Google, HubSpot, and Meta, she covers SEO, paid ads, content strategy, and marketing analytics in her courses.</p>", gender: "women", img: 7 },
  { name: "Babatunde Olatunji", title: "Blockchain Developer & Web3 Educator", bio: "<p>Babatunde is one of Nigeria's foremost blockchain educators, having trained over 5,000 developers in Solidity, smart contract security, and DeFi protocols. He is a core contributor to several open-source Web3 projects.</p>", gender: "men", img: 8 },
  { name: "Grace Mensah", title: "Project Management Professional (PMP)", bio: "<p>Grace is a PMP-certified project manager with 15 years of experience managing complex IT and infrastructure projects across West Africa. She simplifies agile, scrum, and traditional PM methodologies for practitioners at all levels.</p>", gender: "women", img: 9 },
  { name: "Tunde Fashola Jr.", title: "Backend Engineer — Node.js & Python", bio: "<p>Tunde is a backend specialist with deep expertise in Node.js, Django, and PostgreSQL. He has built high-traffic APIs serving millions of requests per day and loves teaching systems design alongside clean code principles.</p>", gender: "men", img: 10 },
  { name: "Adaeze Nwosu", title: "Graphic Design & Brand Identity Expert", bio: "<p>Adaeze is a creative director who has built brand identities for startups, NGOs, and international companies. Her courses cover the full design spectrum from typography to visual storytelling using Adobe Creative Suite and Canva.</p>", gender: "women", img: 11 },
  { name: "Femi Adesanya", title: "Electrical Engineering & Robotics", bio: "<p>Femi is a robotics engineer with experience in embedded systems, Arduino, and industrial automation. He has delivered robotics workshops in 12 African countries and believes hardware literacy is the future of African tech.</p>", gender: "men", img: 12 },
  { name: "Yewande Adekoya", title: "Business Analysis & Financial Modelling", bio: "<p>Yewande is a Chartered Accountant and business analyst who specialises in financial modelling, valuation, and data analysis for decision-making. She has advised SMEs and startups across Nigeria and Ghana on financial strategy.</p>", gender: "women", img: 13 },
  { name: "Emeka Nwofor", title: "Video Production & Film-making", bio: "<p>Emeka is an award-winning filmmaker and video editor who has worked on documentaries, commercials, and Nollywood productions. He teaches cinematography, colour grading, and storytelling for aspiring creators.</p>", gender: "men", img: 14 },
  { name: "Kemi Adeleke", title: "English Communication & Public Speaking", bio: "<p>Kemi is a communications coach with two decades of experience training executives, public officials, and students in professional English writing and public speaking. She has a Masters in Linguistics from the University of Ibadan.</p>", gender: "women", img: 15 },
  { name: "Nnamdi Obi", title: "Ethical Hacking & Network Security", bio: "<p>Nnamdi is a network security expert and certified ethical hacker who has worked with financial regulators and banks to harden their infrastructure. His practical courses focus on real-world attack simulations and defenses.</p>", gender: "men", img: 16 },
  { name: "Bola Ogunleye", title: "Human Resources & Organisational Development", bio: "<p>Bola is an HR strategist with 18 years of experience in talent acquisition, performance management, and organisational culture design. She has led HR functions for multinationals operating across Sub-Saharan Africa.</p>", gender: "women", img: 17 },
  { name: "David Asante", title: "Mathematics & STEM Educator", bio: "<p>David is a mathematics educator and academic with a passion for making complex topics accessible. He has taught at universities in Ghana and the UK, and his online courses in calculus, algebra, and statistics have helped thousands of students pass their exams.</p>", gender: "men", img: 18 },
  { name: "Folake Obi", title: "Nutrition & Wellness Coach", bio: "<p>Folake is a registered dietitian and certified wellness coach who helps individuals and organisations adopt sustainable healthy habits. She combines evidence-based nutrition science with practical meal planning and lifestyle coaching.</p>", gender: "women", img: 19 },
  { name: "Samuel Kwame", title: "Entrepreneurship & Startup Mentorship", bio: "<p>Samuel is a serial entrepreneur who has founded and exited three tech startups in Ghana. He mentors founders on idea validation, fundraising, product-market fit, and scaling operations across Africa.</p>", gender: "men", img: 20 },
  { name: "Chioma Eze", title: "Legal Tech & Contract Law", bio: "<p>Chioma is a qualified barrister and technology law specialist. She advises startups on regulatory compliance, intellectual property, and contract negotiation. Her courses demystify the legal landscape for non-lawyers in the tech industry.</p>", gender: "women", img: 21 },
  { name: "Rotimi Alabi", title: "Photography & Adobe Lightroom", bio: "<p>Rotimi is a commercial photographer whose work has appeared in international magazines and advertising campaigns. He teaches composition, lighting, portrait photography, and professional post-processing workflows.</p>", gender: "men", img: 22 },
  { name: "Adaora Obiechina", title: "Software Testing & QA Engineering", bio: "<p>Adaora is a QA lead with expertise in manual and automated testing using Selenium, Cypress, and Playwright. She has built testing frameworks from scratch for fintech and e-commerce platforms and teaches testers to think like developers.</p>", gender: "women", img: 23 },
  { name: "Ibrahim Musa", title: "Arabic Language & Islamic Studies", bio: "<p>Ibrahim holds an advanced degree in Arabic language and Islamic jurisprudence from Al-Azhar University. He has been teaching Arabic to non-native speakers for 14 years with a focus on Modern Standard Arabic and Quranic recitation.</p>", gender: "men", img: 24 },
  { name: "Patience Owusu", title: "Early Childhood Education & Montessori", bio: "<p>Patience is a certified Montessori educator with 20 years of experience running early childhood learning centres. She trains teachers and parents in child development, play-based learning, and inclusive classroom practices.</p>", gender: "women", img: 25 },
  { name: "Kayode Bamidele", title: "Supply Chain & Logistics Management", bio: "<p>Kayode is a supply chain professional with 16 years of experience in procurement, inventory management, and last-mile logistics. He has managed supply chains for FMCG companies and NGOs across Africa.</p>", gender: "men", img: 26 },
];

async function main() {
  console.log("🌱 Seeding instructor profiles...");

  const toInsert = INSTRUCTORS.map((ins, i) => ({
    id: crypto.randomUUID(),
    name: ins.name,
    email: `instructor.${ins.name.toLowerCase().replace(/[^a-z]/g, ".")}@tyims.edu`,
    role: "INSTRUCTOR" as const,
    image: `https://randomuser.me/api/portraits/${ins.gender}/${ins.img}.jpg`,
    aboutMe: ins.bio,
    title: ins.title,
    emailVerified: true,
    password: null,
    isBlocked: false,
    instructorRequestStatus: "APPROVED" as const,
  }));

  let inserted = 0;
  for (const instructor of toInsert) {
    try {
      await db.insert(users).values(instructor as any).onConflictDoNothing();
      inserted++;
      process.stdout.write(`  ✅ ${instructor.name}\n`);
    } catch (e: any) {
      process.stdout.write(`  ⚠️  Skipped ${instructor.name}: ${e.message}\n`);
    }
  }

  console.log(`\n✅ Done — inserted ${inserted} instructor(s).`);
  process.exit(0);
}

main();
