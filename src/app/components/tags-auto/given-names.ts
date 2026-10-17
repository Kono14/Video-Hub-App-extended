// Given names, in lower case -- to recognise performers known by a first name only, as some studios name them
// in the middle of a title (`Finally Got To Fuck Kiara`). Mostly female names of many languages, some male ones.
// Left out on purpose: names that are common words in titles (may, star, angel, honey, candy, joy, baby ...)

const names = `
aaliyah abby abella abigail ada adele adelina adeline adriana adrianna adrienne agata agatha agnes agnieszka aida aiko
aileen aimee aisha alana alanna alba alejandra alena alessa alessandra alessia alexa alexandra alexia alexis alice alicia
alina aline alisa alise alisha alison alissa alivia aliya aliyah aliza allie allison ally alma alyona alyssa amanda amara
amaya amber amelia amelie amy ana anabel anabella anais anastasia anastasiya andrea andreea angela angelica angelika
angelina angelique angie ani anika anita anja anjelica ann anna annabel annabella annabelle anne anneli annette annie
annika anny antonella antonia anya april ariana arianna ariel ariella arina arya ashlee ashley ashlyn asia astrid athena
aubree aubrey audrey aurelia aurora autumn ava avery aya ayla bailey barbara barbie beatrice beatriz becky belinda bella
belle berenice bernadette beth bethany betty bianca bianka billie blair blake blanca bonnie brandi brandy bree brenda
brianna bridget bridgette brigitte britney britt britta brittany brittney brooke brooklyn bunny cadence caitlin callie
cameron camila camilla camille candace cara carina carla carly carmela carmen carol carolina caroline cassandra cassidy
cassie catalina catarina catherine cathy cecilia celeste celia celina celine chanel chantal charity charlee charli
charlie charlotte chelsea cherie cheryl chiara chloe chrissy christa christina christine cindy claire clara clarissa
claudia cleo coco colette connie cora coral corinna courtney cristina crystal cynthia dafne daisy dakota dana danae
daniela daniella danielle danika daphne darcy daria darina darya dasha dayana deborah debra delia delilah demi denise
desiree diana diane dina dominika dominique donna dora doris dorothy dulce dylan ebony eden edith edyta ekaterina elena
eleonora eliana elina elisa elisabeth elise eliza elizabeth ella elle ellen ellie elly eloise elsa elvira ema emely emilia
emilie emily emma emmanuelle erica erika erin esmeralda esperanza estella estelle ester esther eva evangelina eve evelin
evelina evelyn evie fabiana faye felicia felicity fernanda fiona flavia flora florence france francesca francine frankie
freya frida gabby gabriela gabriella gabrielle gaby gemma georgia georgie gia giada gianna gigi gina ginger giovanna gisele
giselle giulia gloria grace gracie greta gwen hailey haley halle hana hanna hannah harley harmony harper hayley hazel
heather heidi helen helena helga henna hilary hillary holly ida ilona imogen ines inga ingrid inna irene irina iris isabel
isabela isabella isabelle isla ivana ivanka ivy izabela jacky jacqueline jada jade jaelyn jamie jana jane janet janice
janine jasmin jasmine jayden jayla jaylene jazlyn jazmin jean jenifer jenna jennie jennifer jenny jessa jessi jessica jessie
jewel jill jillian jo joanna jocelyn jodi johanna jolene jordan josephine josie joslyn joy judith julia juliana julianna
julie juliet julieta juliette june justine kaisa kaitlyn kali kamila kara karen karina karla karolina kasey kassandra kat
kate katerina katharina katherine kathleen kathryn kathy katia katie katrin katrina katya kay kaya kayla kaylee kaylie
keira kelly kelsey kendall kendra kenna kenzie kesha khloe kiara kiera kim kimber kimberly kira kirsten kitty kristen
kristin kristina kristine krystal ksenia kylie lacey lacy laila lana lara larissa laura laurel lauren laurie layla lea
leah leana leila lena leona leonie lera lesya lexi lexie lia liana libby lidia lika lila lilian liliana lilith lilly lily
lina linda lindsay lindsey lisa liv livia liya liz liza lizzie lola lolita lora lorena loretta lori lorna lottie louisa
louise lucia luciana lucie lucy luisa luna lyla lydia lyra mackenzie maddie maddy madeline madison madisyn mae maggie maia
maja malena malina mandy mara marcela marcy margaret margarita margo margot maria mariah mariana marianne marie marika
marilyn marina marisa marissa marjorie marla marlene marta martha martina mary masha matilda maya mckenzie meg megan
melania melanie melina melinda melissa melody mercedes meredith mia micaela michaela michelle mika mila milana milena
miley mimi mina mira miranda mireille miriam misha missy misty molly monica monika morgan nadia nadine nadya nancy naomi
nastya natali natalia natalie natalya natasha nathalie naya nelly nicole nika niki nikita nikki nina noa noelle nora
norah nova oksana olga olivia olya paige pamela paola paris patricia patty paula paulina pauline penelope penny petra
peyton phoebe piper polina priscilla rachel rachelle raquel rebeca rebecca regina reina renata renee rhiannon riley rita
roberta robin romana rosa rosalie rosalinda rosie roxana roxanne roxy ruby ruth sabina sabrina sadie sally samantha sandra
sara sarah sasha savannah scarlet scarlett selena selina serena sharon shelby shelly sheri sheridan sherry shirley sienna
sierra silvia simona simone sofia sofie sonia sonya sophia sophie stacey stacy stefania stella stephanie summer susan
susanna suzanne suzie svetlana sybil sydney sylvia tabitha talia tamara tami tania tanya tara tasha tatiana tatum taylor
teagan tegan teresa tess tessa thea theresa tiana tiffany tina tori tracy trinity trisha valentina valeria valerie
vanessa vera veronica veronika vicky victoria vika viktoria violet violetta virginia vivian viviana vivienne wendy whitney
willow wilma xenia yana yasmin yolanda yulia yvette yvonne zara zaya zoe zoey zuzana
adam alex alexander andre andrew anthony antonio archie ben brad bruce carlos charles chris christian daniel danny david
diego dylan eddie eric erik frank george jack jake james jason john johnny jordan josh julian justin kevin kyle leo lucas
manuel marco mark martin matt max michael mick mike nick oliver oscar paul pedro peter rocco ryan sam sebastian steve
thomas tom tommy tony victor
`;

export const givenNames: Set<string> = new Set(names.split(/\s+/).filter(Boolean));
