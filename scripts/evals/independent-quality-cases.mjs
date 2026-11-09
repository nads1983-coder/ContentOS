// Synthetic, independent from the original eight evaluation briefs.
export const independentCases = [
 {id:'independent-books',source:'Harbour Books will host a reading group on 17 January at 6pm in Bristol. Entry is free. The selected book has not been announced.',selectedTypes:['instagram','facebook']},
 {id:'independent-checklist',source:'A small bakery shares its preparation checklist: confirm the ingredients, preheat the oven, and label each batch before it leaves the kitchen.',selectedTypes:['linkedin','twitter']},
 {id:'independent-pilot',source:'A community garden is planning a seed swap for Sunday. The organisers have not yet confirmed a venue or opening time.',selectedTypes:['tiktok','youtubeShorts']},
 {id:'independent-course',source:'Mira Studio runs a pottery class in Leeds on 20 February at 3pm. Tickets cost £18. Bring an apron. Materials are supplied.',selectedTypes:['instagram','carousel','xThread']},
 {id:'independent-unicode',source:'Pâtisserie Lumière offers café crème and pastries on Friday. The menu includes a £7 lunch option. Delivery is not available.',selectedTypes:['instagram','platformHashtags']},
 {id:'independent-founder',source:'I am considering changing careers after 12 years in the same job. I am worried about starting again and have not decided what to do.',selectedTypes:['linkedin','hooks']},
 {id:'independent-news',source:'A library poetry reading is planned for 3 March at 7pm. Capacity is 40. Booking opens on 12 February. No poets have been announced.',selectedTypes:['emailNewsletter','xThread']},
 {id:'independent-repair',source:'A bicycle safety checklist has three steps: inspect tyres, test brakes, and check lights. It is general information, not a repair appointment.',selectedTypes:['repurposePack','shortVideoScript']},
 {id:'independent-privacy',source:'A clinic shares general wellbeing information about hydration and suggests people ask a qualified professional for individual advice. It makes no claims about treatment outcomes.',selectedTypes:['facebook','instagram']},
 {id:'independent-neutral',source:'A design studio invites feedback on an early sketch. The final design, launch date and pricing have not been decided.',selectedTypes:['linkedin','twitter','ctas']}
].map(c=>({...c,automaticSettings:[]}));
